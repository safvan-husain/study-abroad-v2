use spacetimedb::{ReducerContext, Table};

pub const MAX_IDENTIFIER_LENGTH: usize = 128;
pub const MAX_IDEMPOTENCY_KEY_LENGTH: usize = 256;
pub const MAX_RESULT_LENGTH: usize = 512;

#[spacetimedb::table(accessor = job, public)]
pub struct Job {
    #[primary_key]
    pub turn_id: String,
    #[unique]
    pub idempotency_key: String,
    pub conversation_id: String,
    pub agent_thread_id: String,
    pub status: String,
    pub worker_id: Option<String>,
    pub lease_until: Option<i64>,
    pub attempt: u32,
    pub run_id: Option<String>,
    pub result: Option<String>,
}

#[spacetimedb::table(accessor = access_fact, public)]
pub struct AccessFact {
    #[primary_key]
    pub fact_id: String,
    pub subject_id: String,
    pub conversation_id: String,
    pub can_read: bool,
}

#[spacetimedb::table(accessor = host_catalog, public)]
pub struct HostCatalog {
    #[primary_key]
    pub host_id: String,
    pub display_name: String,
    pub enabled: bool,
}

fn caller(ctx: &ReducerContext) -> String {
    ctx.sender().to_string()
}

pub fn validate_enqueue_input(
    conversation_id: &str,
    turn_id: &str,
    agent_thread_id: &str,
    idempotency_key: &str,
) -> Result<(), &'static str> {
    if conversation_id.is_empty() || conversation_id.len() > MAX_IDENTIFIER_LENGTH {
        return Err("invalid conversation identifier");
    }
    if turn_id.is_empty() || turn_id.len() > MAX_IDENTIFIER_LENGTH {
        return Err("invalid turn identifier");
    }
    if agent_thread_id.is_empty() || agent_thread_id.len() > MAX_IDENTIFIER_LENGTH {
        return Err("invalid agent thread identifier");
    }
    if idempotency_key.is_empty() || idempotency_key.len() > MAX_IDEMPOTENCY_KEY_LENGTH {
        return Err("invalid idempotency key");
    }
    Ok(())
}

pub fn validate_result(result: &str) -> Result<(), &'static str> {
    if result.is_empty() || result.len() > MAX_RESULT_LENGTH {
        return Err("result is outside the compact payload bound");
    }
    Ok(())
}

pub fn lease_is_expired(job: &Job, now_micros: i64) -> bool {
    job.lease_until.unwrap_or_default() <= now_micros
}

pub fn lease_owner_matches(job: &Job, worker_id: &str) -> bool {
    job.status == "claimed" && job.worker_id.as_deref() == Some(worker_id)
}

#[spacetimedb::reducer]
pub fn enqueue(
    ctx: &ReducerContext,
    conversation_id: String,
    turn_id: String,
    agent_thread_id: String,
    idempotency_key: String,
) {
    validate_enqueue_input(
        &conversation_id,
        &turn_id,
        &agent_thread_id,
        &idempotency_key,
    )
    .unwrap_or_else(|error| panic!("{error}"));
    if ctx.db.job().turn_id().find(&turn_id).is_some()
        || ctx
            .db
            .job()
            .idempotency_key()
            .find(&idempotency_key)
            .is_some()
    {
        return;
    }
    ctx.db.job().insert(Job {
        turn_id,
        idempotency_key,
        conversation_id,
        agent_thread_id,
        status: "pending".into(),
        worker_id: None,
        lease_until: None,
        attempt: 0,
        run_id: None,
        result: None,
    });
}

#[spacetimedb::reducer]
pub fn claim(ctx: &ReducerContext, turn_id: String, lease_seconds: u64) {
    if lease_seconds == 0 {
        panic!("lease must be positive")
    }
    let mut job = ctx
        .db
        .job()
        .turn_id()
        .find(&turn_id)
        .expect("job not found");
    if job.status == "claimed"
        && !lease_is_expired(&job, ctx.timestamp.to_micros_since_unix_epoch())
    {
        panic!("lease active")
    }
    if job.status != "pending" && job.status != "retrying" {
        return;
    }
    job.status = "claimed".into();
    job.worker_id = Some(caller(ctx));
    job.lease_until =
        Some(ctx.timestamp.to_micros_since_unix_epoch() + (lease_seconds * 1_000_000) as i64);
    job.attempt += 1;
    ctx.db.job().turn_id().update(job);
}

#[spacetimedb::reducer]
pub fn renew(ctx: &ReducerContext, turn_id: String, lease_seconds: u64) {
    let mut j = ctx
        .db
        .job()
        .turn_id()
        .find(&turn_id)
        .expect("job not found");
    if j.worker_id.as_deref() != Some(&caller(ctx)) || j.status != "claimed" {
        panic!("not lease owner")
    }
    j.lease_until =
        Some(ctx.timestamp.to_micros_since_unix_epoch() + (lease_seconds * 1_000_000) as i64);
    ctx.db.job().turn_id().update(j);
}

fn finish(
    ctx: &ReducerContext,
    turn_id: String,
    status: &str,
    run_id: Option<String>,
    result: Option<String>,
) {
    let mut j = ctx
        .db
        .job()
        .turn_id()
        .find(&turn_id)
        .expect("job not found");
    if !lease_owner_matches(&j, &caller(ctx)) {
        panic!("not lease owner")
    }
    if let Some(value) = result.as_deref() {
        validate_result(value).unwrap_or_else(|error| panic!("{error}"));
    }
    if let Some(value) = run_id.as_deref() {
        if value.is_empty() || value.len() > MAX_IDENTIFIER_LENGTH {
            panic!("invalid run identifier")
        }
    }
    j.status = status.into();
    j.run_id = run_id;
    j.result = result;
    j.lease_until = None;
    ctx.db.job().turn_id().update(j);
}
#[spacetimedb::reducer]
pub fn complete(ctx: &ReducerContext, turn_id: String, run_id: String, result: String) {
    finish(ctx, turn_id, "completed", Some(run_id), Some(result));
}
#[spacetimedb::reducer]
pub fn retry(ctx: &ReducerContext, turn_id: String, result: String) {
    finish(ctx, turn_id, "retrying", None, Some(result));
}
#[spacetimedb::reducer]
pub fn fail(ctx: &ReducerContext, turn_id: String, result: String) {
    finish(ctx, turn_id, "failed", None, Some(result));
}

#[cfg(test)]
mod tests {
    use super::{
        Job, lease_is_expired, lease_owner_matches, validate_enqueue_input, validate_result,
    };

    fn job(status: &str, worker_id: Option<&str>, lease_until: Option<i64>) -> Job {
        Job {
            turn_id: "turn-1".into(),
            idempotency_key: "idempotency-1".into(),
            conversation_id: "conversation-1".into(),
            agent_thread_id: "conversation-1".into(),
            status: status.into(),
            worker_id: worker_id.map(str::to_owned),
            lease_until,
            attempt: 1,
            run_id: None,
            result: None,
        }
    }

    #[test]
    fn validates_bounded_enqueue_references() {
        assert!(validate_enqueue_input("conversation-1", "turn-1", "thread-1", "key-1").is_ok());
        assert!(validate_enqueue_input("", "turn-1", "thread-1", "key-1").is_err());
        assert!(validate_enqueue_input("conversation-1", "turn-1", "thread-1", "").is_err());
        assert!(
            validate_enqueue_input("conversation-1", "turn-1", "thread-1", &"x".repeat(257))
                .is_err()
        );
    }

    #[test]
    fn requires_the_lease_owner_and_recovers_expired_leases() {
        let active = job("claimed", Some("worker-1"), Some(101));
        let expired = job("claimed", Some("worker-1"), Some(99));

        assert!(!lease_is_expired(&active, 100));
        assert!(lease_is_expired(&expired, 100));
        assert!(lease_owner_matches(&active, "worker-1"));
        assert!(!lease_owner_matches(&active, "worker-2"));
        assert!(!lease_owner_matches(
            &job("pending", None, None),
            "worker-1"
        ));
    }

    #[test]
    fn bounds_compact_results() {
        assert!(validate_result("run=run-1;message=m-1").is_ok());
        assert!(validate_result("").is_err());
        assert!(validate_result(&"x".repeat(513)).is_err());
    }
}
