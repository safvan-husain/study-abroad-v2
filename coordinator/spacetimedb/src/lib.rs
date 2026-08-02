use spacetimedb::{Identity, ReducerContext, SpacetimeType, Table, ViewContext};

pub const MAX_IDENTIFIER_LENGTH: usize = 128;
pub const MAX_TURN_ID_LENGTH: usize = 100;
pub const MAX_MESSAGE_LENGTH: usize = 16_000;
pub const MAX_AWARENESS_LENGTH: usize = 512;
pub const MAX_ERROR_LENGTH: usize = 512;
pub const MAX_WORKER_LABEL_LENGTH: usize = 128;
pub const MAX_WORK_KIND_LENGTH: usize = 64;
pub const MAX_WORK_PAYLOAD_LENGTH: usize = 4_096;
pub const MAX_WORK_ITEMS: usize = 8;
pub const MAX_LEASE_SECONDS: u64 = 3_600;
pub const DIRECTIVE_SCHEMA_VERSION: u32 = 1;
pub const DISCOVERY_VIEW: &str = "discovery";
const ROLE_AI_AGENT: u8 = 2;
const AGENT_USERNAME: &str = "study_abroad_agent";
const AGENT_PASSWORD: &str = "study-agent-dev";

#[spacetimedb::table(accessor = app_user)]
pub struct AppUser {
    #[primary_key]
    pub user_id: u32,
    #[unique]
    pub username: String,
    pub password_hash: String,
    pub role: u8,
    pub active: bool,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = auth_session)]
pub struct AuthSession {
    #[primary_key]
    pub identity: Identity,
    pub user_id: u32,
    pub username: String,
    pub logged_in_at_micros: i64,
}

#[spacetimedb::table(accessor = principal)]
pub struct Principal {
    #[primary_key]
    pub principal_id: String,
    pub kind: String,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = conversation_membership)]
pub struct ConversationMembership {
    #[primary_key]
    pub membership_id: String,
    #[index(btree)]
    pub conversation_id: String,
    #[index(btree)]
    pub principal_id: String,
}

#[spacetimedb::table(accessor = conversation)]
pub struct Conversation {
    #[primary_key]
    pub conversation_id: String,
    #[index(btree)]
    pub owner_principal_id: String,
    pub agent_thread_id: String,
    pub next_sequence: u64,
    pub ui_revision: u64,
    pub context_revision: u64,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = message)]
pub struct Message {
    #[primary_key]
    pub message_id: String,
    #[index(btree)]
    pub conversation_id: String,
    #[index(btree)]
    pub turn_id: String,
    pub sequence: u64,
    pub role: String,
    pub content: String,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = message_part)]
pub struct MessagePart {
    #[primary_key]
    pub part_id: String,
    #[index(btree)]
    pub conversation_id: String,
    #[index(btree)]
    pub message_id: String,
    pub kind: String,
    pub payload_json: String,
}

#[spacetimedb::table(accessor = command)]
pub struct Command {
    #[primary_key]
    pub command_id: String,
    #[index(btree)]
    pub principal_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub turn_id: String,
    pub kind: String,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = turn_job)]
pub struct TurnJob {
    #[primary_key]
    pub turn_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub user_message_id: String,
    pub agent_thread_id: String,
    pub correlation_id: String,
    #[index(btree)]
    pub status: String,
    pub worker_id: Option<String>,
    pub lease_until_micros: Option<i64>,
    pub attempt: u32,
    pub base_ui_revision: u64,
    pub run_id: Option<String>,
    pub error_code: Option<String>,
}

#[spacetimedb::table(accessor = active_directive)]
pub struct ActiveDirective {
    #[primary_key]
    pub conversation_id: String,
    pub schema_version: u32,
    pub ui_revision: u64,
    pub source_turn_id: Option<String>,
    pub work_set_id: Option<String>,
    pub view_type: String,
    pub awareness: String,
    pub updated_at_micros: i64,
}

#[spacetimedb::table(accessor = workspace_work_set)]
pub struct WorkspaceWorkSet {
    #[primary_key]
    pub work_set_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub source_turn_id: String,
    pub kind: String,
    pub status: String,
    pub expected_context_revision: u64,
    pub expected_ui_revision: u64,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = workspace_work_item)]
pub struct WorkspaceWorkItem {
    #[primary_key]
    pub work_item_id: String,
    #[index(btree)]
    pub work_set_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub kind: String,
    pub input_json: String,
    #[index(btree)]
    pub status: String,
    pub worker_id: Option<String>,
    pub lease_until_micros: Option<i64>,
    pub attempt: u32,
    pub expected_context_revision: u64,
    pub expected_ui_revision: u64,
    pub error_code: Option<String>,
}

#[spacetimedb::table(accessor = workspace_result)]
pub struct WorkspaceResult {
    #[primary_key]
    pub work_item_id: String,
    #[index(btree)]
    pub work_set_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub result_revision: u64,
    pub result_json: String,
    pub run_id: Option<String>,
    pub completed_at_micros: i64,
}

#[spacetimedb::table(accessor = user_action)]
pub struct UserAction {
    #[primary_key]
    pub action_id: String,
    #[index(btree)]
    pub principal_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub kind: String,
    pub entity_ref: Option<String>,
    pub resulting_context_revision: u64,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = worker_principal)]
pub struct WorkerPrincipal {
    #[primary_key]
    pub worker_id: String,
    pub label: String,
    pub registered_at_micros: i64,
}

#[derive(SpacetimeType)]
pub struct WorkerPendingTurn {
    pub turn_id: String,
    pub conversation_id: String,
    pub agent_thread_id: String,
    pub correlation_id: String,
    pub user_message_id: String,
    pub user_content: String,
    pub status: String,
    pub lease_until_micros: Option<i64>,
    pub attempt: u32,
    pub base_ui_revision: u64,
}

#[derive(SpacetimeType)]
pub struct WorkItemSpec {
    pub entity_type: String,
    pub entity_id: String,
    pub kind: String,
    pub input_json: String,
}

#[derive(SpacetimeType)]
pub struct WorkerPendingWorkItem {
    pub work_item_id: String,
    pub work_set_id: String,
    pub conversation_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub kind: String,
    pub input_json: String,
    pub status: String,
    pub lease_until_micros: Option<i64>,
    pub attempt: u32,
    pub expected_context_revision: u64,
    pub expected_ui_revision: u64,
}

fn caller(ctx: &ReducerContext) -> String {
    ctx.sender().to_string()
}

fn now_micros(ctx: &ReducerContext) -> i64 {
    ctx.timestamp.to_micros_since_unix_epoch()
}

fn hash_password(password: &str) -> String {
    format!("blake3:{}", blake3::hash(password.as_bytes()).to_hex())
}

fn constant_time_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut difference = 0u8;
    for (a, b) in left.iter().zip(right.iter()) {
        difference |= a ^ b;
    }
    difference == 0
}

fn verify_password(password: &str, password_hash: &str) -> bool {
    constant_time_eq(hash_password(password).as_bytes(), password_hash.as_bytes())
}

fn normalize_username(username: &str) -> String {
    username.trim().to_lowercase()
}

fn next_user_id(ctx: &ReducerContext) -> u32 {
    ctx.db
        .app_user()
        .iter()
        .map(|user| user.user_id)
        .max()
        .unwrap_or(0)
        .checked_add(1)
        .expect("user id exhausted")
}

fn seed_agent_user(ctx: &ReducerContext) {
    if let Some(mut user) = ctx.db.app_user().username().find(AGENT_USERNAME.to_owned()) {
        user.password_hash = hash_password(AGENT_PASSWORD);
        user.role = ROLE_AI_AGENT;
        user.active = true;
        ctx.db.app_user().user_id().update(user);
        return;
    }

    ctx.db.app_user().insert(AppUser {
        user_id: next_user_id(ctx),
        username: AGENT_USERNAME.to_owned(),
        password_hash: hash_password(AGENT_PASSWORD),
        role: ROLE_AI_AGENT,
        active: true,
        created_at_micros: now_micros(ctx),
    });
}

fn signed_in_user(ctx: &ReducerContext) -> Option<AppUser> {
    let session = ctx.db.auth_session().identity().find(ctx.sender())?;
    ctx.db.app_user().user_id().find(session.user_id)
}

fn ensure_worker_auth(ctx: &ReducerContext) {
    let user = signed_in_user(ctx).unwrap_or_else(|| panic!("worker login required"));
    if !user.active || user.role != ROLE_AI_AGENT {
        panic!("AI worker role required");
    }
}

fn validate_identifier(value: &str, message: &'static str) -> Result<(), &'static str> {
    if value.is_empty() || value.len() > MAX_IDENTIFIER_LENGTH {
        return Err(message);
    }
    Ok(())
}

pub fn validate_conversation_id(conversation_id: &str) -> Result<(), &'static str> {
    validate_identifier(conversation_id, "invalid conversation identifier")
}

pub fn validate_command_id(command_id: &str) -> Result<(), &'static str> {
    if command_id.is_empty() || command_id.len() > MAX_TURN_ID_LENGTH {
        return Err("invalid command identifier");
    }
    Ok(())
}

pub fn validate_message_content(content: &str) -> Result<(), &'static str> {
    if content.trim().is_empty() || content.len() > MAX_MESSAGE_LENGTH {
        return Err("message content is outside the payload bound");
    }
    Ok(())
}

pub fn validate_error_code(error_code: &str) -> Result<(), &'static str> {
    if error_code.is_empty() || error_code.len() > MAX_ERROR_LENGTH {
        return Err("error code is outside the payload bound");
    }
    Ok(())
}

pub fn validate_work_item_spec(spec: &WorkItemSpec) -> Result<(), &'static str> {
    validate_identifier(&spec.entity_type, "invalid work entity type")?;
    validate_identifier(&spec.entity_id, "invalid work entity identifier")?;
    if spec.kind.is_empty() || spec.kind.len() > MAX_WORK_KIND_LENGTH {
        return Err("invalid work item kind");
    }
    if spec.input_json.len() > MAX_WORK_PAYLOAD_LENGTH {
        return Err("work item input is outside the payload bound");
    }
    Ok(())
}

pub fn validate_directive(
    schema_version: u32,
    view_type: &str,
    awareness: &str,
) -> Result<(), &'static str> {
    if schema_version != DIRECTIVE_SCHEMA_VERSION {
        return Err("unsupported directive schema version");
    }
    if view_type != DISCOVERY_VIEW {
        return Err("unsupported directive view type");
    }
    if awareness.len() > MAX_AWARENESS_LENGTH {
        return Err("directive awareness is outside the payload bound");
    }
    Ok(())
}

pub fn validate_directive_revision(
    current_ui_revision: u64,
    expected_ui_revision: u64,
    requested_ui_revision: u64,
) -> Result<(), &'static str> {
    if current_ui_revision != expected_ui_revision {
        return Err("stale directive revision");
    }
    if requested_ui_revision != expected_ui_revision.saturating_add(1) {
        return Err("invalid directive revision");
    }
    Ok(())
}

pub fn lease_is_expired(job: &TurnJob, now: i64) -> bool {
    job.lease_until_micros.unwrap_or_default() <= now
}

pub fn lease_owner_matches(job: &TurnJob, worker_id: &str, attempt: u32, now: i64) -> bool {
    job.status == "claimed"
        && job.worker_id.as_deref() == Some(worker_id)
        && job.attempt == attempt
        && !lease_is_expired(job, now)
}

pub fn work_item_lease_is_expired(item: &WorkspaceWorkItem, now: i64) -> bool {
    item.lease_until_micros.unwrap_or_default() <= now
}

pub fn work_item_lease_owner_matches(
    item: &WorkspaceWorkItem,
    worker_id: &str,
    attempt: u32,
    now: i64,
) -> bool {
    item.status == "claimed"
        && item.worker_id.as_deref() == Some(worker_id)
        && item.attempt == attempt
        && !work_item_lease_is_expired(item, now)
}

fn work_item_is_claimable(item: &WorkspaceWorkItem, expected_attempt: u32, now: i64) -> bool {
    item.attempt == expected_attempt
        && (item.status == "pending"
            || item.status == "retrying"
            || (item.status == "claimed" && work_item_lease_is_expired(item, now)))
}

fn turn_is_claimable(job: &TurnJob, expected_attempt: u32, now: i64) -> bool {
    job.attempt == expected_attempt
        && (job.status == "pending"
            || job.status == "retrying"
            || (job.status == "claimed" && lease_is_expired(job, now)))
}

fn assistant_message_id(turn_id: &str) -> String {
    format!("{turn_id}-assistant")
}

fn work_set_id(turn_id: &str) -> String {
    format!("{turn_id}-work")
}

fn work_item_id(work_set_id: &str, index: usize) -> String {
    format!("{work_set_id}-{index}")
}

fn refresh_work_set_status(ctx: &ReducerContext, work_set_id: &str) {
    let mut work_set = ctx
        .db
        .workspace_work_set()
        .work_set_id()
        .find(work_set_id.to_owned())
        .expect("work set not found");
    let items: Vec<_> = ctx
        .db
        .workspace_work_item()
        .work_set_id()
        .filter(work_set_id)
        .collect();
    let completed = items.iter().filter(|item| item.status == "completed").count();
    let failed = items
        .iter()
        .filter(|item| item.status == "failed" || item.status == "obsolete")
        .count();
    let active = items.len().saturating_sub(completed + failed);
    work_set.status = if active > 0 && completed > 0 {
        "partial"
    } else if active > 0 {
        "pending"
    } else if failed > 0 {
        "completed_with_errors"
    } else {
        "completed"
    }
    .into();
    ctx.db.workspace_work_set().work_set_id().update(work_set);
}

fn directive_part_payload(schema_version: u32, ui_revision: u64, view_type: &str) -> String {
    format!(
        r#"{{"schemaVersion":{schema_version},"uiRevision":{ui_revision},"type":"{view_type}"}}"#
    )
}

fn ensure_member(ctx: &ReducerContext, conversation_id: &str) {
    let principal_id = caller(ctx);
    let is_member = ctx
        .db
        .conversation_membership()
        .principal_id()
        .filter(&principal_id)
        .any(|membership| membership.conversation_id == conversation_id);
    if !is_member {
        panic!("conversation access denied");
    }
}

fn has_active_turn(ctx: &ReducerContext, conversation_id: &str) -> bool {
    let conversation_id = conversation_id.to_owned();
    ctx.db
        .turn_job()
        .conversation_id()
        .filter(&conversation_id)
        .any(|job| job.status == "pending" || job.status == "claimed" || job.status == "retrying")
}

fn ensure_registered_worker(ctx: &ReducerContext) {
    ensure_worker_auth(ctx);
    if ctx.db.worker_principal().worker_id().find(&caller(ctx)).is_none() {
        panic!("worker is not registered");
    }
}

fn finish_with_error(
    ctx: &ReducerContext,
    turn_id: String,
    attempt: u32,
    status: &str,
    error_code: String,
) {
    ensure_registered_worker(ctx);
    validate_error_code(&error_code).unwrap_or_else(|error| panic!("{error}"));
    let now = now_micros(ctx);
    let mut job = ctx
        .db
        .turn_job()
        .turn_id()
        .find(&turn_id)
        .expect("turn not found");
    if !lease_owner_matches(&job, &caller(ctx), attempt, now) {
        panic!("stale or unauthorized turn attempt");
    }
    job.status = status.into();
    job.lease_until_micros = None;
    job.error_code = Some(error_code);
    ctx.db.turn_job().turn_id().update(job);
}

#[spacetimedb::reducer]
pub fn ensure_guest_journey(ctx: &ReducerContext, conversation_id: String) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    let principal_id = caller(ctx);
    if let Some(existing) = ctx.db.conversation().conversation_id().find(&conversation_id) {
        if existing.owner_principal_id != principal_id {
            panic!("conversation access denied");
        }
        return;
    }

    let now = now_micros(ctx);
    if ctx.db.principal().principal_id().find(&principal_id).is_none() {
        ctx.db.principal().insert(Principal {
            principal_id: principal_id.clone(),
            kind: "guest".into(),
            created_at_micros: now,
        });
    }
    ctx.db.conversation().insert(Conversation {
        conversation_id: conversation_id.clone(),
        owner_principal_id: principal_id.clone(),
        agent_thread_id: conversation_id.clone(),
        next_sequence: 1,
        ui_revision: 0,
        context_revision: 0,
        created_at_micros: now,
    });
    ctx.db.conversation_membership().insert(ConversationMembership {
        membership_id: conversation_id.clone(),
        conversation_id,
        principal_id,
    });
}

#[spacetimedb::reducer(init)]
pub fn init(ctx: &ReducerContext) -> Result<(), String> {
    seed_agent_user(ctx);
    Ok(())
}

#[spacetimedb::reducer]
pub fn login(ctx: &ReducerContext, username: String, password: String) -> Result<(), String> {
    seed_agent_user(ctx);
    let username = normalize_username(&username);
    let user = ctx
        .db
        .app_user()
        .username()
        .find(username.clone())
        .ok_or_else(|| "Username does not exist.".to_owned())?;
    if !user.active {
        return Err("User is inactive.".to_owned());
    }
    if !verify_password(&password, &user.password_hash) {
        return Err("Password is incorrect.".to_owned());
    }

    let session = AuthSession {
        identity: ctx.sender(),
        user_id: user.user_id,
        username: user.username,
        logged_in_at_micros: now_micros(ctx),
    };
    if ctx.db.auth_session().identity().find(ctx.sender()).is_some() {
        ctx.db.auth_session().identity().update(session);
    } else {
        ctx.db.auth_session().insert(session);
    }
    Ok(())
}

#[spacetimedb::reducer]
pub fn send_message(
    ctx: &ReducerContext,
    conversation_id: String,
    client_command_id: String,
    content: String,
) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    validate_command_id(&client_command_id).unwrap_or_else(|error| panic!("{error}"));
    let content = content.trim().to_owned();
    validate_message_content(&content).unwrap_or_else(|error| panic!("{error}"));
    ensure_member(ctx, &conversation_id);

    if ctx.db.command().command_id().find(&client_command_id).is_some() {
        return;
    }
    if has_active_turn(ctx, &conversation_id) {
        panic!("conversation already has an active turn");
    }

    let now = now_micros(ctx);
    let mut conversation = ctx
        .db
        .conversation()
        .conversation_id()
        .find(&conversation_id)
        .expect("conversation not found");
    let sequence = conversation.next_sequence;
    conversation.next_sequence = conversation
        .next_sequence
        .checked_add(1)
        .expect("conversation sequence exhausted");
    ctx.db.message().insert(Message {
        message_id: client_command_id.clone(),
        conversation_id: conversation_id.clone(),
        turn_id: client_command_id.clone(),
        sequence,
        role: "user".into(),
        content,
        created_at_micros: now,
    });
    ctx.db.command().insert(Command {
        command_id: client_command_id.clone(),
        principal_id: caller(ctx),
        conversation_id: conversation_id.clone(),
        turn_id: client_command_id.clone(),
        kind: "send_message".into(),
        created_at_micros: now,
    });
    ctx.db.turn_job().insert(TurnJob {
        turn_id: client_command_id.clone(),
        conversation_id,
        user_message_id: client_command_id.clone(),
        agent_thread_id: conversation.agent_thread_id.clone(),
        correlation_id: client_command_id,
        status: "pending".into(),
        worker_id: None,
        lease_until_micros: None,
        attempt: 0,
        base_ui_revision: conversation.ui_revision,
        run_id: None,
        error_code: None,
    });
    ctx.db.conversation().conversation_id().update(conversation);
}

#[spacetimedb::reducer]
pub fn register_worker(ctx: &ReducerContext, worker_label: String) {
    ensure_worker_auth(ctx);
    validate_identifier(&worker_label, "invalid worker label")
        .and_then(|_| {
            if worker_label.len() > MAX_WORKER_LABEL_LENGTH {
                Err("invalid worker label")
            } else {
                Ok(())
            }
        })
        .unwrap_or_else(|error| panic!("{error}"));
    let worker_id = caller(ctx);
    if ctx
        .db
        .worker_principal()
        .worker_id()
        .find(&worker_id)
        .is_none()
    {
        ctx.db.worker_principal().insert(WorkerPrincipal {
            worker_id,
            label: worker_label,
            registered_at_micros: now_micros(ctx),
        });
    }
}

#[spacetimedb::reducer]
pub fn claim(ctx: &ReducerContext, turn_id: String, expected_attempt: u32, lease_seconds: u64) {
    ensure_registered_worker(ctx);
    if lease_seconds == 0 || lease_seconds > MAX_LEASE_SECONDS {
        panic!("lease duration is outside the allowed bound");
    }
    let now = now_micros(ctx);
    let mut job = ctx
        .db
        .turn_job()
        .turn_id()
        .find(&turn_id)
        .expect("turn not found");
    if !turn_is_claimable(&job, expected_attempt, now) {
        panic!("turn is not claimable");
    }
    job.status = "claimed".into();
    job.worker_id = Some(caller(ctx));
    job.lease_until_micros = Some(now + (lease_seconds * 1_000_000) as i64);
    job.attempt = job.attempt.checked_add(1).expect("turn attempt exhausted");
    ctx.db.turn_job().turn_id().update(job);
}

#[spacetimedb::reducer]
pub fn renew(ctx: &ReducerContext, turn_id: String, attempt: u32, lease_seconds: u64) {
    ensure_registered_worker(ctx);
    if lease_seconds == 0 || lease_seconds > MAX_LEASE_SECONDS {
        panic!("lease duration is outside the allowed bound");
    }
    let now = now_micros(ctx);
    let mut job = ctx
        .db
        .turn_job()
        .turn_id()
        .find(&turn_id)
        .expect("turn not found");
    if !lease_owner_matches(&job, &caller(ctx), attempt, now) {
        panic!("stale or unauthorized turn attempt");
    }
    job.lease_until_micros = Some(now + (lease_seconds * 1_000_000) as i64);
    ctx.db.turn_job().turn_id().update(job);
}

#[spacetimedb::reducer]
pub fn complete_turn(
    ctx: &ReducerContext,
    turn_id: String,
    attempt: u32,
    assistant_content: String,
    run_id: String,
    agent_thread_id: String,
    directive_schema_version: u32,
    directive_ui_revision: u64,
    directive_type: String,
    directive_awareness: String,
    work_kind: String,
    work_items: Vec<WorkItemSpec>,
) {
    ensure_registered_worker(ctx);
    validate_message_content(&assistant_content).unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&run_id, "invalid run identifier").unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&agent_thread_id, "invalid agent thread identifier")
        .unwrap_or_else(|error| panic!("{error}"));
    validate_directive(
        directive_schema_version,
        &directive_type,
        &directive_awareness,
    )
    .unwrap_or_else(|error| panic!("{error}"));
    if work_items.len() > MAX_WORK_ITEMS {
        panic!("too many work items");
    }
    if !work_items.is_empty() && (work_kind.is_empty() || work_kind.len() > MAX_WORK_KIND_LENGTH) {
        panic!("invalid work set kind");
    }
    for spec in &work_items {
        validate_work_item_spec(spec).unwrap_or_else(|error| panic!("{error}"));
    }

    let now = now_micros(ctx);
    let mut job = ctx
        .db
        .turn_job()
        .turn_id()
        .find(&turn_id)
        .expect("turn not found");
    if !lease_owner_matches(&job, &caller(ctx), attempt, now) {
        panic!("stale or unauthorized turn attempt");
    }
    if job.agent_thread_id != agent_thread_id {
        panic!("agent thread does not match the conversation");
    }
    let mut conversation = ctx
        .db
        .conversation()
        .conversation_id()
        .find(&job.conversation_id)
        .expect("conversation not found");
    if conversation.agent_thread_id != agent_thread_id {
        panic!("agent thread does not match the conversation");
    }
    validate_directive_revision(
        conversation.ui_revision,
        job.base_ui_revision,
        directive_ui_revision,
    )
    .unwrap_or_else(|error| panic!("{error}"));
    if let Some(existing) = ctx
        .db
        .active_directive()
        .conversation_id()
        .find(&conversation.conversation_id)
    {
        if existing.ui_revision != job.base_ui_revision {
            panic!("stale directive revision");
        }
    }

    let assistant_message_id = assistant_message_id(&turn_id);
    let sequence = conversation.next_sequence;
    conversation.next_sequence = conversation
        .next_sequence
        .checked_add(1)
        .expect("conversation sequence exhausted");
    conversation.ui_revision = directive_ui_revision;
    ctx.db.message().insert(Message {
        message_id: assistant_message_id.clone(),
        conversation_id: job.conversation_id.clone(),
        turn_id: turn_id.clone(),
        sequence,
        role: "assistant".into(),
        content: assistant_content,
        created_at_micros: now,
    });
    ctx.db.message_part().insert(MessagePart {
        part_id: turn_id.clone(),
        conversation_id: job.conversation_id.clone(),
        message_id: assistant_message_id,
        kind: "workspace_directive".into(),
        payload_json: directive_part_payload(
            directive_schema_version,
            directive_ui_revision,
            &directive_type,
        ),
    });
    let created_work_set_id = (!work_items.is_empty()).then(|| work_set_id(&turn_id));
    if let Some(ref set_id) = created_work_set_id {
        if ctx.db.workspace_work_set().work_set_id().find(set_id).is_some() {
            panic!("work set already exists");
        }
        ctx.db.workspace_work_set().insert(WorkspaceWorkSet {
            work_set_id: set_id.clone(),
            conversation_id: job.conversation_id.clone(),
            source_turn_id: turn_id.clone(),
            kind: work_kind,
            status: "pending".into(),
            expected_context_revision: conversation.context_revision,
            expected_ui_revision: directive_ui_revision,
            created_at_micros: now,
        });
        for (index, spec) in work_items.into_iter().enumerate() {
            ctx.db.workspace_work_item().insert(WorkspaceWorkItem {
                work_item_id: work_item_id(set_id, index),
                work_set_id: set_id.clone(),
                conversation_id: job.conversation_id.clone(),
                entity_type: spec.entity_type,
                entity_id: spec.entity_id,
                kind: spec.kind,
                input_json: spec.input_json,
                status: "pending".into(),
                worker_id: None,
                lease_until_micros: None,
                attempt: 0,
                expected_context_revision: conversation.context_revision,
                expected_ui_revision: directive_ui_revision,
                error_code: None,
            });
        }
    }
    let directive = ActiveDirective {
        conversation_id: job.conversation_id.clone(),
        schema_version: directive_schema_version,
        ui_revision: directive_ui_revision,
        source_turn_id: Some(turn_id.clone()),
        work_set_id: created_work_set_id,
        view_type: directive_type,
        awareness: directive_awareness,
        updated_at_micros: now,
    };
    if ctx
        .db
        .active_directive()
        .conversation_id()
        .find(&directive.conversation_id)
        .is_some()
    {
        ctx.db.active_directive().conversation_id().update(directive);
    } else {
        ctx.db.active_directive().insert(directive);
    }
    job.status = "completed".into();
    job.lease_until_micros = None;
    job.run_id = Some(run_id);
    job.error_code = None;
    ctx.db.turn_job().turn_id().update(job);
    ctx.db.conversation().conversation_id().update(conversation);
}

#[spacetimedb::reducer]
pub fn retry(ctx: &ReducerContext, turn_id: String, attempt: u32, error_code: String) {
    finish_with_error(ctx, turn_id, attempt, "retrying", error_code);
}

#[spacetimedb::reducer]
pub fn fail(ctx: &ReducerContext, turn_id: String, attempt: u32, error_code: String) {
    finish_with_error(ctx, turn_id, attempt, "failed", error_code);
}

#[spacetimedb::reducer]
pub fn claim_work_item(
    ctx: &ReducerContext,
    work_item_id: String,
    expected_attempt: u32,
    lease_seconds: u64,
) {
    ensure_registered_worker(ctx);
    if lease_seconds == 0 || lease_seconds > MAX_LEASE_SECONDS {
        panic!("lease duration is outside the allowed bound");
    }
    let now = now_micros(ctx);
    let mut item = ctx
        .db
        .workspace_work_item()
        .work_item_id()
        .find(&work_item_id)
        .expect("work item not found");
    if !work_item_is_claimable(&item, expected_attempt, now) {
        panic!("work item is not claimable");
    }
    item.status = "claimed".into();
    item.worker_id = Some(caller(ctx));
    item.lease_until_micros = Some(now + (lease_seconds * 1_000_000) as i64);
    item.attempt = item.attempt.checked_add(1).expect("work item attempt exhausted");
    item.error_code = None;
    ctx.db.workspace_work_item().work_item_id().update(item);
}

#[spacetimedb::reducer]
pub fn renew_work_item(
    ctx: &ReducerContext,
    work_item_id: String,
    attempt: u32,
    lease_seconds: u64,
) {
    ensure_registered_worker(ctx);
    if lease_seconds == 0 || lease_seconds > MAX_LEASE_SECONDS {
        panic!("lease duration is outside the allowed bound");
    }
    let now = now_micros(ctx);
    let mut item = ctx
        .db
        .workspace_work_item()
        .work_item_id()
        .find(&work_item_id)
        .expect("work item not found");
    if !work_item_lease_owner_matches(&item, &caller(ctx), attempt, now) {
        panic!("stale or unauthorized work item attempt");
    }
    item.lease_until_micros = Some(now + (lease_seconds * 1_000_000) as i64);
    ctx.db.workspace_work_item().work_item_id().update(item);
}

fn finish_work_item_with_error(
    ctx: &ReducerContext,
    work_item_id: String,
    attempt: u32,
    status: &str,
    error_code: String,
) {
    ensure_registered_worker(ctx);
    validate_error_code(&error_code).unwrap_or_else(|error| panic!("{error}"));
    let now = now_micros(ctx);
    let mut item = ctx
        .db
        .workspace_work_item()
        .work_item_id()
        .find(&work_item_id)
        .expect("work item not found");
    if !work_item_lease_owner_matches(&item, &caller(ctx), attempt, now) {
        panic!("stale or unauthorized work item attempt");
    }
    let set_id = item.work_set_id.clone();
    item.status = status.into();
    item.lease_until_micros = None;
    item.error_code = Some(error_code);
    ctx.db.workspace_work_item().work_item_id().update(item);
    refresh_work_set_status(ctx, &set_id);
}

#[spacetimedb::reducer]
pub fn retry_work_item(
    ctx: &ReducerContext,
    work_item_id: String,
    attempt: u32,
    error_code: String,
) {
    finish_work_item_with_error(ctx, work_item_id, attempt, "retrying", error_code);
}

#[spacetimedb::reducer]
pub fn fail_work_item(
    ctx: &ReducerContext,
    work_item_id: String,
    attempt: u32,
    error_code: String,
) {
    finish_work_item_with_error(ctx, work_item_id, attempt, "failed", error_code);
}

#[spacetimedb::reducer]
pub fn complete_work_item(
    ctx: &ReducerContext,
    work_item_id: String,
    attempt: u32,
    result_json: String,
    run_id: Option<String>,
) {
    ensure_registered_worker(ctx);
    if result_json.is_empty() || result_json.len() > MAX_WORK_PAYLOAD_LENGTH {
        panic!("work result is outside the payload bound");
    }
    if let Some(ref value) = run_id {
        validate_identifier(value, "invalid run identifier").unwrap_or_else(|error| panic!("{error}"));
    }
    let now = now_micros(ctx);
    let mut item = ctx
        .db
        .workspace_work_item()
        .work_item_id()
        .find(&work_item_id)
        .expect("work item not found");
    if !work_item_lease_owner_matches(&item, &caller(ctx), attempt, now) {
        panic!("stale or unauthorized work item attempt");
    }
    let conversation = ctx
        .db
        .conversation()
        .conversation_id()
        .find(&item.conversation_id)
        .expect("conversation not found");
    let directive = ctx
        .db
        .active_directive()
        .conversation_id()
        .find(&item.conversation_id)
        .expect("active directive not found");
    let applicable = conversation.context_revision == item.expected_context_revision
        && conversation.ui_revision == item.expected_ui_revision
        && directive.ui_revision == item.expected_ui_revision
        && directive.work_set_id.as_deref() == Some(item.work_set_id.as_str());
    let set_id = item.work_set_id.clone();
    if applicable {
        ctx.db.workspace_result().insert(WorkspaceResult {
            work_item_id: item.work_item_id.clone(),
            work_set_id: set_id.clone(),
            conversation_id: item.conversation_id.clone(),
            result_revision: 1,
            result_json,
            run_id,
            completed_at_micros: now,
        });
        item.status = "completed".into();
    } else {
        item.status = "obsolete".into();
        item.error_code = Some("stale_context".into());
    }
    item.lease_until_micros = None;
    ctx.db.workspace_work_item().work_item_id().update(item);
    refresh_work_set_status(ctx, &set_id);
}

fn caller_conversation_ids(ctx: &ViewContext) -> Vec<String> {
    let principal_id = ctx.sender().to_string();
    ctx.db
        .conversation_membership()
        .principal_id()
        .filter(&principal_id)
        .map(|membership| membership.conversation_id)
        .collect()
}

#[spacetimedb::view(accessor = my_conversations, public)]
fn my_conversations(ctx: &ViewContext) -> Vec<Conversation> {
    caller_conversation_ids(ctx)
        .into_iter()
        .filter_map(|conversation_id| ctx.db.conversation().conversation_id().find(&conversation_id))
        .collect()
}

#[spacetimedb::view(accessor = my_messages, public)]
fn my_messages(ctx: &ViewContext) -> Vec<Message> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .message()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

#[spacetimedb::view(accessor = my_message_parts, public)]
fn my_message_parts(ctx: &ViewContext) -> Vec<MessagePart> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .message_part()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

#[spacetimedb::view(accessor = my_turns, public)]
fn my_turns(ctx: &ViewContext) -> Vec<TurnJob> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .turn_job()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

#[spacetimedb::view(accessor = my_active_directives, public)]
fn my_active_directives(ctx: &ViewContext) -> Vec<ActiveDirective> {
    caller_conversation_ids(ctx)
        .into_iter()
        .filter_map(|conversation_id| {
            ctx.db
                .active_directive()
                .conversation_id()
                .find(&conversation_id)
        })
        .collect()
}

#[spacetimedb::view(accessor = my_workspace_work_sets, public)]
fn my_workspace_work_sets(ctx: &ViewContext) -> Vec<WorkspaceWorkSet> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .workspace_work_set()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

#[spacetimedb::view(accessor = my_workspace_work_items, public)]
fn my_workspace_work_items(ctx: &ViewContext) -> Vec<WorkspaceWorkItem> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .workspace_work_item()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

#[spacetimedb::view(accessor = my_workspace_results, public)]
fn my_workspace_results(ctx: &ViewContext) -> Vec<WorkspaceResult> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .workspace_result()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

#[spacetimedb::view(accessor = my_user_actions, public)]
fn my_user_actions(ctx: &ViewContext) -> Vec<UserAction> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .user_action()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

fn is_registered_worker_view(ctx: &ViewContext) -> bool {
    let session = match ctx.db.auth_session().identity().find(ctx.sender()) {
        Some(session) => session,
        None => return false,
    };
    match ctx.db.app_user().user_id().find(session.user_id) {
        Some(user) if user.active && user.role == ROLE_AI_AGENT => {}
        _ => return false,
    }
    ctx.db
        .worker_principal()
        .worker_id()
        .find(&ctx.sender().to_string())
        .is_some()
}

#[spacetimedb::view(accessor = worker_pending_turns, public)]
fn worker_pending_turns(ctx: &ViewContext) -> Vec<WorkerPendingTurn> {
    if !is_registered_worker_view(ctx) {
        return vec![];
    }

    ["pending", "retrying", "claimed"]
        .into_iter()
        .flat_map(|status| ctx.db.turn_job().status().filter(status))
        .filter_map(|job| {
            ctx.db
                .message()
                .message_id()
                .find(&job.user_message_id)
                .map(|message| WorkerPendingTurn {
                    turn_id: job.turn_id,
                    conversation_id: job.conversation_id,
                    agent_thread_id: job.agent_thread_id,
                    correlation_id: job.correlation_id,
                    user_message_id: message.message_id,
                    user_content: message.content,
                    status: job.status,
                    lease_until_micros: job.lease_until_micros,
                    attempt: job.attempt,
                    base_ui_revision: job.base_ui_revision,
                })
        })
        .collect()
}

#[spacetimedb::view(accessor = worker_pending_work_items, public)]
fn worker_pending_work_items(ctx: &ViewContext) -> Vec<WorkerPendingWorkItem> {
    if !is_registered_worker_view(ctx) {
        return vec![];
    }
    ["pending", "retrying", "claimed"]
        .into_iter()
        .flat_map(|status| ctx.db.workspace_work_item().status().filter(status))
        .map(|item| WorkerPendingWorkItem {
            work_item_id: item.work_item_id,
            work_set_id: item.work_set_id,
            conversation_id: item.conversation_id,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            kind: item.kind,
            input_json: item.input_json,
            status: item.status,
            lease_until_micros: item.lease_until_micros,
            attempt: item.attempt,
            expected_context_revision: item.expected_context_revision,
            expected_ui_revision: item.expected_ui_revision,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        DISCOVERY_VIEW, TurnJob, WorkItemSpec, WorkspaceWorkItem, lease_is_expired,
        lease_owner_matches, turn_is_claimable,
        validate_command_id, validate_conversation_id, validate_directive,
        validate_directive_revision, validate_error_code, validate_message_content,
        validate_work_item_spec, work_item_is_claimable, work_item_lease_owner_matches,
    };

    fn turn(status: &str, worker_id: Option<&str>, lease_until_micros: Option<i64>, attempt: u32) -> TurnJob {
        TurnJob {
            turn_id: "turn-1".into(),
            conversation_id: "conversation-1".into(),
            user_message_id: "turn-1".into(),
            agent_thread_id: "conversation-1".into(),
            correlation_id: "turn-1".into(),
            status: status.into(),
            worker_id: worker_id.map(str::to_owned),
            lease_until_micros,
            attempt,
            base_ui_revision: 0,
            run_id: None,
            error_code: None,
        }
    }

    fn work_item(status: &str, worker_id: Option<&str>, lease_until_micros: Option<i64>, attempt: u32) -> WorkspaceWorkItem {
        WorkspaceWorkItem {
            work_item_id: "turn-1-work-0".into(),
            work_set_id: "turn-1-work".into(),
            conversation_id: "conversation-1".into(),
            entity_type: "discovery_topic".into(),
            entity_id: "goals".into(),
            kind: "advisor_prompt".into(),
            input_json: "{}".into(),
            status: status.into(),
            worker_id: worker_id.map(str::to_owned),
            lease_until_micros,
            attempt,
            expected_context_revision: 0,
            expected_ui_revision: 1,
            error_code: None,
        }
    }

    #[test]
    fn validates_sender_supplied_ids_and_payloads() {
        assert!(validate_conversation_id("conversation-1").is_ok());
        assert!(validate_conversation_id("").is_err());
        assert!(validate_command_id("command-1").is_ok());
        assert!(validate_command_id(&"x".repeat(101)).is_err());
        assert!(validate_message_content("hello").is_ok());
        assert!(validate_message_content("   ").is_err());
        assert!(validate_message_content(&"x".repeat(16_001)).is_err());
        assert!(validate_error_code("agent_unavailable").is_ok());
        assert!(validate_error_code(&"x".repeat(513)).is_err());
        assert!(validate_work_item_spec(&WorkItemSpec {
            entity_type: "discovery_topic".into(),
            entity_id: "goals".into(),
            kind: "advisor_prompt".into(),
            input_json: "{}".into(),
        }).is_ok());
    }

    #[test]
    fn accepts_only_the_initial_typed_directive_contract() {
        assert!(validate_directive(1, DISCOVERY_VIEW, "Ready to help.").is_ok());
        assert!(validate_directive(2, DISCOVERY_VIEW, "Ready").is_err());
        assert!(validate_directive(1, "catalog", "Ready").is_err());
        assert!(validate_directive(1, DISCOVERY_VIEW, &"x".repeat(513)).is_err());
    }

    #[test]
    fn rejects_stale_directive_revisions() {
        assert!(validate_directive_revision(3, 3, 4).is_ok());
        assert!(validate_directive_revision(4, 3, 4).is_err());
        assert!(validate_directive_revision(3, 3, 5).is_err());
    }

    #[test]
    fn fences_lease_owners_and_allows_expired_recovery() {
        let active = turn("claimed", Some("worker-1"), Some(101), 2);
        let expired = turn("claimed", Some("worker-1"), Some(99), 2);

        assert!(!lease_is_expired(&active, 100));
        assert!(lease_is_expired(&expired, 100));
        assert!(lease_owner_matches(&active, "worker-1", 2, 100));
        assert!(!lease_owner_matches(&active, "worker-2", 2, 100));
        assert!(!lease_owner_matches(&active, "worker-1", 1, 100));
        assert!(!turn_is_claimable(&active, 2, 100));
        assert!(turn_is_claimable(&expired, 2, 100));
        assert!(turn_is_claimable(&turn("retrying", None, None, 2), 2, 100));

        let item = work_item("claimed", Some("worker-1"), Some(101), 2);
        assert!(work_item_lease_owner_matches(&item, "worker-1", 2, 100));
        assert!(!work_item_lease_owner_matches(&item, "worker-2", 2, 100));
        assert!(work_item_is_claimable(
            &work_item("claimed", Some("worker-1"), Some(99), 2),
            2,
            100,
        ));
    }
}
