use serde::{Deserialize, Serialize};
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
pub const CATALOG_VIEW: &str = "catalog";
pub const MAX_PROFILE_FIELD_LENGTH: usize = 1_024;
pub const MAX_STUDENT_PHRASE_LENGTH: usize = 256;
pub const MAX_TURN_UPDATE_KIND_LENGTH: usize = 64;
pub const MAX_TURN_UPDATE_PAYLOAD_LENGTH: usize = 4_096;
pub const MAX_TURN_UPDATES_PER_CONVERSATION: usize = 32;
pub const MAX_CATALOG_AREA_LENGTH: usize = 64;
pub const MAX_CATALOG_NAME_LENGTH: usize = 256;
pub const UI_TARGET_SCHEMA_VERSION: u32 = 1;
pub const MAX_UI_TARGET_LENGTH: usize = 1_024;
pub const MAX_UI_LABEL_LENGTH: usize = 256;
pub const UI_STATE_FRESH_MICROS: i64 = 30_000_000;
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

#[spacetimedb::table(accessor = workspace_work_control)]
pub struct WorkspaceWorkControl {
    #[primary_key]
    pub work_item_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub display_title: String,
    pub order_index: u32,
    pub target_json: String,
    pub dependency_json: String,
}

#[spacetimedb::table(accessor = user_ui_state)]
pub struct UserUiState {
    #[primary_key]
    pub state_id: String,
    #[index(btree)]
    pub conversation_id: String,
    #[index(btree)]
    pub principal_id: String,
    pub client_instance_id: String,
    pub target_json: String,
    pub navigation_revision: u64,
    pub visible: bool,
    pub last_seen_at_micros: i64,
}

#[spacetimedb::table(accessor = turn_ui_origin)]
pub struct TurnUiOrigin {
    #[primary_key]
    pub turn_id: String,
    #[index(btree)]
    pub conversation_id: String,
    #[index(btree)]
    pub principal_id: String,
    pub client_instance_id: String,
    pub target_json: String,
    pub navigation_revision: u64,
    pub created_at_micros: i64,
}

#[spacetimedb::table(accessor = ui_action)]
pub struct UiAction {
    #[primary_key]
    pub action_id: String,
    #[index(btree)]
    pub conversation_id: String,
    #[index(btree)]
    pub principal_id: String,
    pub client_instance_id: String,
    pub source_kind: String,
    pub source_id: String,
    pub kind: String,
    pub label: String,
    pub button_label: String,
    pub target_json: String,
    pub base_target_json: String,
    pub base_navigation_revision: u64,
    pub activation: String,
    #[index(btree)]
    pub status: String,
    pub created_at_micros: i64,
    pub updated_at_micros: i64,
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

#[spacetimedb::table(accessor = catalog_institution, public)]
pub struct CatalogInstitution {
    #[primary_key]
    pub institution_id: String,
    pub name: String,
    pub country: String,
    pub city: String,
    pub active: bool,
}

#[spacetimedb::table(accessor = catalog_course, public)]
pub struct CatalogCourse {
    #[primary_key]
    pub course_id: String,
    #[index(btree)]
    pub institution_id: String,
    pub institution_name: String,
    pub country: String,
    pub city: String,
    pub name: String,
    #[index(btree)]
    pub area: String,
    pub level: String,
    pub tuition_band: String,
    pub english_bar: String,
    pub active: bool,
}

#[spacetimedb::table(accessor = conversation_profile)]
pub struct ConversationProfile {
    #[primary_key]
    pub conversation_id: String,
    #[index(btree)]
    pub profile_queue_key: u32,
    pub background: String,
    pub course_interests: String,
    pub ambitions: String,
    pub primary_area: String,
    pub candidate_areas_json: String,
    pub student_phrase: String,
    pub constraints_text: String,
    pub updated_at_micros: i64,
}

#[spacetimedb::table(accessor = turn_update)]
pub struct TurnUpdate {
    #[primary_key]
    #[auto_inc]
    pub update_id: u64,
    #[index(btree)]
    pub turn_id: String,
    #[index(btree)]
    pub conversation_id: String,
    pub attempt: u32,
    pub sequence: u32,
    pub kind: String,
    pub payload_json: String,
    pub created_at_micros: i64,
}

#[derive(SpacetimeType, Clone)]
pub struct CatalogCourseSeed {
    pub course_id: String,
    pub institution_id: String,
    pub institution_name: String,
    pub country: String,
    pub city: String,
    pub name: String,
    pub area: String,
    pub level: String,
    pub tuition_band: String,
    pub english_bar: String,
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
    pub ui_client_instance_id: String,
    pub ui_target_json: String,
    pub ui_navigation_revision: u64,
}

#[derive(SpacetimeType)]
pub struct WorkItemSpec {
    pub entity_type: String,
    pub entity_id: String,
    pub kind: String,
    pub display_title: String,
    pub order_index: u32,
    pub target_json: String,
    pub dependency_json: String,
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
    pub display_title: String,
    pub order_index: u32,
    pub target_json: String,
    pub dependency_json: String,
    pub input_json: String,
    pub status: String,
    pub lease_until_micros: Option<i64>,
    pub attempt: u32,
    pub expected_context_revision: u64,
    pub expected_ui_revision: u64,
    pub ui_client_instance_id: String,
    pub ui_target_json: String,
    pub ui_navigation_revision: u64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UiTargetRef {
    pub schema_version: u32,
    pub view_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub work_set_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entity_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slot: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ProfileDependency {
    pub background: String,
    pub course_interests: String,
    pub ambitions: String,
    pub primary_area: String,
    pub candidate_areas: Vec<String>,
    pub student_phrase: String,
    pub constraints_text: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CourseDependency {
    pub course_id: String,
    pub institution_id: String,
    pub institution_name: String,
    pub country: String,
    pub city: String,
    pub name: String,
    pub area: String,
    pub level: String,
    pub tuition_band: String,
    pub english_bar: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(deny_unknown_fields)]
pub struct CourseSummaryDependencies {
    pub profile: ProfileDependency,
    pub course: CourseDependency,
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
    if spec.display_title.is_empty() || spec.display_title.len() > MAX_UI_LABEL_LENGTH {
        return Err("invalid work item display title");
    }
    validate_ui_target_json(&spec.target_json)?;
    if spec.dependency_json.is_empty() || spec.dependency_json.len() > MAX_WORK_PAYLOAD_LENGTH {
        return Err("work item dependencies are outside the payload bound");
    }
    if spec.kind == "course_fit_summary"
        && serde_json::from_str::<CourseSummaryDependencies>(&spec.dependency_json).is_err()
    {
        return Err("invalid course summary dependencies");
    }
    if spec.input_json.len() > MAX_WORK_PAYLOAD_LENGTH {
        return Err("work item input is outside the payload bound");
    }
    Ok(())
}

fn validate_work_item_target(
    spec: &WorkItemSpec,
    expected_work_set_id: &str,
) -> Result<(), &'static str> {
    let target = validate_ui_target_json(&spec.target_json)?;
    if target.work_set_id.as_deref() != Some(expected_work_set_id) {
        return Err("UI target does not match the work set");
    }
    if target.view_type == "course_summary"
        && (target.entity_type.as_deref() != Some(spec.entity_type.as_str())
            || target.entity_id.as_deref() != Some(spec.entity_id.as_str()))
    {
        return Err("UI target does not match the work entity");
    }
    Ok(())
}

pub fn validate_ui_target_json(target_json: &str) -> Result<UiTargetRef, &'static str> {
    if target_json.is_empty() || target_json.len() > MAX_UI_TARGET_LENGTH {
        return Err("UI target is outside the payload bound");
    }
    let target: UiTargetRef = serde_json::from_str(target_json).map_err(|_| "invalid UI target")?;
    if target.schema_version != UI_TARGET_SCHEMA_VERSION {
        return Err("unsupported UI target schema version");
    }
    for value in [
        target.work_set_id.as_deref(),
        target.entity_type.as_deref(),
        target.entity_id.as_deref(),
        target.slot.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        validate_identifier(value, "invalid UI target identifier")?;
    }
    match target.view_type.as_str() {
        "home"
            if target.work_set_id.is_none()
                && target.entity_type.is_none()
                && target.entity_id.is_none()
                && target.slot.is_none() =>
        {
            Ok(target)
        }
        "catalog" => Ok(target),
        "course_summary"
            if target.work_set_id.is_some()
                && target.entity_type.as_deref() == Some("course")
                && target.entity_id.is_some() =>
        {
            Ok(target)
        }
        "home" | "course_summary" => Err("incomplete UI target"),
        _ => Err("unsupported UI target view type"),
    }
}

fn validate_resolvable_ui_target(
    ctx: &ReducerContext,
    conversation_id: &str,
    target_json: &str,
) -> Result<UiTargetRef, &'static str> {
    let target = validate_ui_target_json(target_json)?;
    if target.view_type == "home" || (target.view_type == "catalog" && target.work_set_id.is_none())
    {
        return Ok(target);
    }
    let work_set_id = target
        .work_set_id
        .clone()
        .ok_or("UI target work set is required")?;
    let work_set = ctx
        .db
        .workspace_work_set()
        .work_set_id()
        .find(&work_set_id)
        .ok_or("UI target work set not found")?;
    if work_set.conversation_id != conversation_id {
        return Err("UI target work set belongs to another conversation");
    }
    if target.view_type == "course_summary" {
        let entity_id = target
            .entity_id
            .as_deref()
            .ok_or("UI target entity is required")?;
        let found = ctx
            .db
            .workspace_work_item()
            .work_set_id()
            .filter(&work_set_id)
            .any(|item| item.entity_type == "course" && item.entity_id == entity_id);
        if !found {
            return Err("UI target course is not in the work set");
        }
    }
    Ok(target)
}

pub fn validate_directive(
    schema_version: u32,
    view_type: &str,
    awareness: &str,
) -> Result<(), &'static str> {
    if schema_version != DIRECTIVE_SCHEMA_VERSION {
        return Err("unsupported directive schema version");
    }
    if view_type != DISCOVERY_VIEW && view_type != CATALOG_VIEW {
        return Err("unsupported directive view type");
    }
    if awareness.len() > MAX_AWARENESS_LENGTH {
        return Err("directive awareness is outside the payload bound");
    }
    Ok(())
}

pub fn validate_profile_field(value: &str) -> Result<(), &'static str> {
    if value.len() > MAX_PROFILE_FIELD_LENGTH {
        return Err("profile field is outside the payload bound");
    }
    Ok(())
}

pub fn validate_student_phrase(value: &str) -> Result<(), &'static str> {
    if value.len() > MAX_STUDENT_PHRASE_LENGTH {
        return Err("student phrase is outside the payload bound");
    }
    Ok(())
}

pub fn validate_turn_update(kind: &str, payload_json: &str) -> Result<(), &'static str> {
    if kind.is_empty() || kind.len() > MAX_TURN_UPDATE_KIND_LENGTH {
        return Err("invalid turn update kind");
    }
    if payload_json.is_empty() || payload_json.len() > MAX_TURN_UPDATE_PAYLOAD_LENGTH {
        return Err("turn update payload is outside the payload bound");
    }
    match kind {
        "turn_started" | "course_search_started" | "course_search_results_ready" => Ok(()),
        _ => Err("unsupported turn update kind"),
    }
}

pub fn validate_catalog_course_seed(course: &CatalogCourseSeed) -> Result<(), &'static str> {
    validate_identifier(&course.course_id, "invalid course identifier")?;
    validate_identifier(&course.institution_id, "invalid institution identifier")?;
    if course.institution_name.is_empty() || course.institution_name.len() > MAX_CATALOG_NAME_LENGTH
    {
        return Err("invalid institution name");
    }
    if course.name.is_empty() || course.name.len() > MAX_CATALOG_NAME_LENGTH {
        return Err("invalid course name");
    }
    if course.area.is_empty() || course.area.len() > MAX_CATALOG_AREA_LENGTH {
        return Err("invalid course area");
    }
    if course.country.is_empty() || course.country.len() > MAX_CATALOG_AREA_LENGTH {
        return Err("invalid country");
    }
    if course.city.len() > MAX_CATALOG_NAME_LENGTH
        || course.level.len() > MAX_CATALOG_AREA_LENGTH
        || course.tuition_band.len() > MAX_CATALOG_AREA_LENGTH
        || course.english_bar.len() > MAX_CATALOG_AREA_LENGTH
    {
        return Err("catalog course field is outside the payload bound");
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

fn stable_internal_id(parts: &[&str]) -> String {
    let source = parts.join("\u{1f}");
    blake3::hash(source.as_bytes()).to_hex().to_string()
}

fn ui_state_id(principal_id: &str, conversation_id: &str, client_instance_id: &str) -> String {
    stable_internal_id(&[principal_id, conversation_id, client_instance_id])
}

fn ui_action_id(source_kind: &str, source_id: &str) -> String {
    stable_internal_id(&["ui_action", source_kind, source_id])
}

fn ui_state_matches_origin(state: &UserUiState, origin: &TurnUiOrigin, now: i64) -> bool {
    state.principal_id == origin.principal_id
        && state.conversation_id == origin.conversation_id
        && state.client_instance_id == origin.client_instance_id
        && state.navigation_revision == origin.navigation_revision
        && state.target_json == origin.target_json
        && state.visible
        && now.saturating_sub(state.last_seen_at_micros) <= UI_STATE_FRESH_MICROS
}

fn work_item_has_turn_navigation_action(ctx: &ReducerContext, work_item_id: &str) -> bool {
    let Some(item) = ctx
        .db
        .workspace_work_item()
        .work_item_id()
        .find(work_item_id.to_owned())
    else {
        return false;
    };
    let Some(work_set) = ctx
        .db
        .workspace_work_set()
        .work_set_id()
        .find(&item.work_set_id)
    else {
        return false;
    };
    ctx.db
        .ui_action()
        .action_id()
        .find(&ui_action_id("turn", &work_set.source_turn_id))
        .is_some()
}

fn create_ui_action(
    ctx: &ReducerContext,
    origin: &TurnUiOrigin,
    source_kind: &str,
    source_id: &str,
    kind: &str,
    label: String,
    button_label: &str,
    target_json: String,
) {
    validate_resolvable_ui_target(ctx, &origin.conversation_id, &target_json)
        .unwrap_or_else(|error| panic!("{error}"));
    if label.is_empty() || label.len() > MAX_UI_LABEL_LENGTH {
        panic!("invalid UI action label");
    }
    let now = now_micros(ctx);
    let state_id = ui_state_id(
        &origin.principal_id,
        &origin.conversation_id,
        &origin.client_instance_id,
    );
    // A turn-level catalogue action is the single automatic navigation candidate
    // for that turn. Its child summaries remain user-controlled even if they
    // finish before the browser resolves the catalogue action.
    let turn_navigation_exists =
        source_kind == "work_item" && work_item_has_turn_navigation_action(ctx, source_id);
    let status = if turn_navigation_exists {
        "offered"
    } else {
        ctx.db
            .user_ui_state()
            .state_id()
            .find(&state_id)
            .filter(|state| ui_state_matches_origin(state, origin, now))
            .map(|_| "auto_pending")
            .unwrap_or("offered")
    };
    ctx.db.ui_action().insert(UiAction {
        action_id: ui_action_id(source_kind, source_id),
        conversation_id: origin.conversation_id.clone(),
        principal_id: origin.principal_id.clone(),
        client_instance_id: origin.client_instance_id.clone(),
        source_kind: source_kind.into(),
        source_id: source_id.into(),
        kind: kind.into(),
        label,
        button_label: button_label.into(),
        target_json,
        base_target_json: origin.target_json.clone(),
        base_navigation_revision: origin.navigation_revision,
        activation: "auto_if_origin_unchanged".into(),
        status: status.into(),
        created_at_micros: now,
        updated_at_micros: now,
    });
}

fn current_course_summary_dependencies(
    ctx: &ReducerContext,
    item: &WorkspaceWorkItem,
) -> Option<CourseSummaryDependencies> {
    let profile = ctx
        .db
        .conversation_profile()
        .conversation_id()
        .find(&item.conversation_id)?;
    let course = ctx.db.catalog_course().course_id().find(&item.entity_id)?;
    let candidate_areas =
        serde_json::from_str::<Vec<String>>(&profile.candidate_areas_json).ok()?;
    Some(CourseSummaryDependencies {
        profile: ProfileDependency {
            background: profile.background,
            course_interests: profile.course_interests,
            ambitions: profile.ambitions,
            primary_area: profile.primary_area,
            candidate_areas,
            student_phrase: profile.student_phrase,
            constraints_text: profile.constraints_text,
        },
        course: CourseDependency {
            course_id: course.course_id,
            institution_id: course.institution_id,
            institution_name: course.institution_name,
            country: course.country,
            city: course.city,
            name: course.name,
            area: course.area,
            level: course.level,
            tuition_band: course.tuition_band,
            english_bar: course.english_bar,
        },
    })
}

fn refresh_course_summary_input(
    item: &mut WorkspaceWorkItem,
    control: &mut WorkspaceWorkControl,
    dependencies: &CourseSummaryDependencies,
) -> Result<(), &'static str> {
    let mut input: serde_json::Value =
        serde_json::from_str(&item.input_json).map_err(|_| "invalid course summary input")?;
    let object = input
        .as_object_mut()
        .ok_or("invalid course summary input")?;
    object.insert(
        "profile".into(),
        serde_json::to_value(&dependencies.profile).map_err(|_| "invalid profile dependency")?,
    );
    let course =
        serde_json::to_value(&dependencies.course).map_err(|_| "invalid course dependency")?;
    let course = course.as_object().ok_or("invalid course dependency")?;
    for (key, value) in course {
        object.insert(key.clone(), value.clone());
    }
    item.input_json = serde_json::to_string(&input).map_err(|_| "invalid course summary input")?;
    control.dependency_json =
        serde_json::to_string(dependencies).map_err(|_| "invalid course summary dependencies")?;
    Ok(())
}

fn summary_action_label(control: &WorkspaceWorkControl, result_json: &str) -> String {
    let title = serde_json::from_str::<serde_json::Value>(result_json)
        .ok()
        .and_then(|value| {
            value
                .get("title")
                .and_then(|title| title.as_str())
                .map(str::to_owned)
        })
        .filter(|title| !title.trim().is_empty())
        .unwrap_or_else(|| {
            control
                .display_title
                .trim_start_matches("Comparing ")
                .to_owned()
        });
    format!(
        "{} summary added",
        title.chars().take(220).collect::<String>()
    )
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
    let completed = items
        .iter()
        .filter(|item| item.status == "completed")
        .count();
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
    if ctx
        .db
        .worker_principal()
        .worker_id()
        .find(&caller(ctx))
        .is_none()
    {
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
    if let Some(existing) = ctx
        .db
        .conversation()
        .conversation_id()
        .find(&conversation_id)
    {
        if existing.owner_principal_id != principal_id {
            panic!("conversation access denied");
        }
        return;
    }

    let now = now_micros(ctx);
    if ctx
        .db
        .principal()
        .principal_id()
        .find(&principal_id)
        .is_none()
    {
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
    ctx.db
        .conversation_membership()
        .insert(ConversationMembership {
            membership_id: conversation_id.clone(),
            conversation_id: conversation_id.clone(),
            principal_id,
        });
    ctx.db.conversation_profile().insert(ConversationProfile {
        conversation_id,
        profile_queue_key: 1,
        background: String::new(),
        course_interests: String::new(),
        ambitions: String::new(),
        primary_area: String::new(),
        candidate_areas_json: "[]".into(),
        student_phrase: String::new(),
        constraints_text: String::new(),
        updated_at_micros: now,
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
    if ctx
        .db
        .auth_session()
        .identity()
        .find(ctx.sender())
        .is_some()
    {
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
    client_instance_id: String,
    content: String,
) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    validate_command_id(&client_command_id).unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&client_instance_id, "invalid UI client identifier")
        .unwrap_or_else(|error| panic!("{error}"));
    let content = content.trim().to_owned();
    validate_message_content(&content).unwrap_or_else(|error| panic!("{error}"));
    ensure_member(ctx, &conversation_id);

    if ctx
        .db
        .command()
        .command_id()
        .find(&client_command_id)
        .is_some()
    {
        return;
    }
    if has_active_turn(ctx, &conversation_id) {
        panic!("conversation already has an active turn");
    }

    let now = now_micros(ctx);
    let principal_id = caller(ctx);
    let state_id = ui_state_id(&principal_id, &conversation_id, &client_instance_id);
    let ui_state = ctx
        .db
        .user_ui_state()
        .state_id()
        .find(&state_id)
        .expect("originating UI state not found");
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
        principal_id: principal_id.clone(),
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
        correlation_id: client_command_id.clone(),
        status: "pending".into(),
        worker_id: None,
        lease_until_micros: None,
        attempt: 0,
        base_ui_revision: conversation.ui_revision,
        run_id: None,
        error_code: None,
    });
    ctx.db.turn_ui_origin().insert(TurnUiOrigin {
        turn_id: client_command_id,
        conversation_id: conversation.conversation_id.clone(),
        principal_id,
        client_instance_id,
        target_json: ui_state.target_json,
        navigation_revision: ui_state.navigation_revision,
        created_at_micros: now,
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
    validate_identifier(&run_id, "invalid run identifier")
        .unwrap_or_else(|error| panic!("{error}"));
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
    let work_item_count = work_items.len();

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
        if ctx
            .db
            .workspace_work_set()
            .work_set_id()
            .find(set_id)
            .is_some()
        {
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
            validate_work_item_target(&spec, set_id).unwrap_or_else(|error| panic!("{error}"));
            let item_id = work_item_id(set_id, index);
            ctx.db.workspace_work_item().insert(WorkspaceWorkItem {
                work_item_id: item_id.clone(),
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
            ctx.db
                .workspace_work_control()
                .insert(WorkspaceWorkControl {
                    work_item_id: item_id,
                    conversation_id: job.conversation_id.clone(),
                    display_title: spec.display_title,
                    order_index: spec.order_index,
                    target_json: spec.target_json,
                    dependency_json: spec.dependency_json,
                });
        }
    }
    if directive_type == CATALOG_VIEW {
        if let Some(ref set_id) = created_work_set_id {
            let origin = ctx
                .db
                .turn_ui_origin()
                .turn_id()
                .find(&turn_id)
                .expect("turn UI origin not found");
            let target_json = serde_json::to_string(&UiTargetRef {
                schema_version: UI_TARGET_SCHEMA_VERSION,
                view_type: "catalog".into(),
                work_set_id: Some(set_id.clone()),
                entity_type: None,
                entity_id: None,
                slot: None,
            })
            .expect("catalog UI target must serialize");
            create_ui_action(
                ctx,
                &origin,
                "turn",
                &turn_id,
                "open_catalog",
                format!("{work_item_count} course matches ready"),
                "Open courses",
                target_json,
            );
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
        ctx.db
            .active_directive()
            .conversation_id()
            .update(directive);
    } else {
        ctx.db.active_directive().insert(directive);
    }
    job.status = "completed".into();
    job.lease_until_micros = None;
    job.run_id = Some(run_id);
    job.error_code = None;
    let conversation_id_for_cleanup = job.conversation_id.clone();
    let completed_turn_id = turn_id.clone();
    ctx.db.turn_job().turn_id().update(job);
    ctx.db.conversation().conversation_id().update(conversation);
    let stale_updates: Vec<_> = ctx
        .db
        .turn_update()
        .conversation_id()
        .filter(&conversation_id_for_cleanup)
        .collect::<Vec<_>>()
        .into_iter()
        .filter(|row| row.turn_id != completed_turn_id)
        .collect();
    for update in stale_updates {
        ctx.db.turn_update().update_id().delete(&update.update_id);
    }
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
pub fn publish_turn_update(
    ctx: &ReducerContext,
    turn_id: String,
    attempt: u32,
    sequence: u32,
    kind: String,
    payload_json: String,
) {
    ensure_registered_worker(ctx);
    validate_turn_update(&kind, &payload_json).unwrap_or_else(|error| panic!("{error}"));
    let now = now_micros(ctx);
    let job = ctx
        .db
        .turn_job()
        .turn_id()
        .find(&turn_id)
        .expect("turn not found");
    if !lease_owner_matches(&job, &caller(ctx), attempt, now) {
        panic!("stale or unauthorized turn attempt");
    }
    let existing = ctx
        .db
        .turn_update()
        .turn_id()
        .filter(&turn_id)
        .find(|row| row.attempt == attempt && row.sequence == sequence);
    if let Some(row) = existing {
        if row.kind == kind && row.payload_json == payload_json {
            return;
        }
        panic!("conflicting turn update for sequence");
    }
    ctx.db.turn_update().insert(TurnUpdate {
        update_id: 0,
        turn_id,
        conversation_id: job.conversation_id,
        attempt,
        sequence,
        kind,
        payload_json,
        created_at_micros: now,
    });
}

#[spacetimedb::reducer]
pub fn upsert_conversation_profile(
    ctx: &ReducerContext,
    conversation_id: String,
    background: String,
    course_interests: String,
    ambitions: String,
    primary_area: String,
    candidate_areas_json: String,
    student_phrase: String,
    constraints_text: String,
) {
    ensure_registered_worker(ctx);
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    for field in [
        &background,
        &course_interests,
        &ambitions,
        &primary_area,
        &candidate_areas_json,
        &constraints_text,
    ] {
        validate_profile_field(field).unwrap_or_else(|error| panic!("{error}"));
    }
    validate_student_phrase(&student_phrase).unwrap_or_else(|error| panic!("{error}"));
    if ctx
        .db
        .conversation()
        .conversation_id()
        .find(&conversation_id)
        .is_none()
    {
        panic!("conversation not found");
    }
    let now = now_micros(ctx);
    let profile = ConversationProfile {
        conversation_id: conversation_id.clone(),
        profile_queue_key: 1,
        background,
        course_interests,
        ambitions,
        primary_area,
        candidate_areas_json,
        student_phrase,
        constraints_text,
        updated_at_micros: now,
    };
    if ctx
        .db
        .conversation_profile()
        .conversation_id()
        .find(&conversation_id)
        .is_some()
    {
        ctx.db
            .conversation_profile()
            .conversation_id()
            .update(profile);
    } else {
        ctx.db.conversation_profile().insert(profile);
    }
}

#[spacetimedb::reducer]
pub fn update_discovery_profile(
    ctx: &ReducerContext,
    conversation_id: String,
    client_command_id: String,
    background: String,
    course_interests: String,
    ambitions: String,
    primary_area: String,
    candidate_areas_json: String,
    student_phrase: String,
    constraints_text: String,
) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    validate_command_id(&client_command_id).unwrap_or_else(|error| panic!("{error}"));
    ensure_member(ctx, &conversation_id);
    for field in [
        &background,
        &course_interests,
        &ambitions,
        &primary_area,
        &candidate_areas_json,
        &constraints_text,
    ] {
        validate_profile_field(field).unwrap_or_else(|error| panic!("{error}"));
    }
    validate_student_phrase(&student_phrase).unwrap_or_else(|error| panic!("{error}"));
    if ctx
        .db
        .command()
        .command_id()
        .find(&client_command_id)
        .is_some()
    {
        return;
    }
    let now = now_micros(ctx);
    let mut conversation = ctx
        .db
        .conversation()
        .conversation_id()
        .find(&conversation_id)
        .expect("conversation not found");
    conversation.context_revision = conversation
        .context_revision
        .checked_add(1)
        .expect("context revision exhausted");
    let resulting_context_revision = conversation.context_revision;
    ctx.db.conversation().conversation_id().update(conversation);
    ctx.db.command().insert(Command {
        command_id: client_command_id.clone(),
        principal_id: caller(ctx),
        conversation_id: conversation_id.clone(),
        turn_id: client_command_id.clone(),
        kind: "update_discovery_profile".into(),
        created_at_micros: now,
    });
    ctx.db.user_action().insert(UserAction {
        action_id: client_command_id,
        principal_id: caller(ctx),
        conversation_id: conversation_id.clone(),
        kind: "update_discovery_profile".into(),
        entity_ref: Some(conversation_id.clone()),
        resulting_context_revision,
        created_at_micros: now,
    });
    let profile = ConversationProfile {
        conversation_id: conversation_id.clone(),
        profile_queue_key: 1,
        background,
        course_interests,
        ambitions,
        primary_area,
        candidate_areas_json,
        student_phrase,
        constraints_text,
        updated_at_micros: now,
    };
    if ctx
        .db
        .conversation_profile()
        .conversation_id()
        .find(&conversation_id)
        .is_some()
    {
        ctx.db
            .conversation_profile()
            .conversation_id()
            .update(profile);
    } else {
        ctx.db.conversation_profile().insert(profile);
    }
}

#[spacetimedb::reducer]
pub fn replace_catalog(ctx: &ReducerContext, courses: Vec<CatalogCourseSeed>) {
    ensure_worker_auth(ctx);
    if courses.len() > 500 {
        panic!("catalog seed exceeds bound");
    }
    for course in &courses {
        validate_catalog_course_seed(course).unwrap_or_else(|error| panic!("{error}"));
    }
    let mut seen_course_ids = std::collections::HashSet::new();
    let mut institutions = std::collections::HashMap::<String, (String, String, String)>::new();
    for course in &courses {
        if !seen_course_ids.insert(course.course_id.clone()) {
            panic!("duplicate catalog course_id: {}", course.course_id);
        }
        match institutions.get(&course.institution_id) {
            Some((name, country, city))
                if name != &course.institution_name
                    || country != &course.country
                    || city != &course.city =>
            {
                panic!(
                    "conflicting institution metadata for {}: {}",
                    course.institution_id, course.course_id
                );
            }
            Some(_) => {}
            None => {
                institutions.insert(
                    course.institution_id.clone(),
                    (
                        course.institution_name.clone(),
                        course.country.clone(),
                        course.city.clone(),
                    ),
                );
            }
        }
    }
    let existing_courses: Vec<_> = ctx.db.catalog_course().iter().collect();
    for course in existing_courses {
        ctx.db
            .catalog_course()
            .course_id()
            .delete(&course.course_id);
    }
    let existing_institutions: Vec<_> = ctx.db.catalog_institution().iter().collect();
    for institution in existing_institutions {
        ctx.db
            .catalog_institution()
            .institution_id()
            .delete(&institution.institution_id);
    }
    for course in courses {
        if ctx
            .db
            .catalog_institution()
            .institution_id()
            .find(&course.institution_id)
            .is_none()
        {
            ctx.db.catalog_institution().insert(CatalogInstitution {
                institution_id: course.institution_id.clone(),
                name: course.institution_name.clone(),
                country: course.country.clone(),
                city: course.city.clone(),
                active: true,
            });
        }
        ctx.db.catalog_course().insert(CatalogCourse {
            course_id: course.course_id,
            institution_id: course.institution_id,
            institution_name: course.institution_name,
            country: course.country,
            city: course.city,
            name: course.name,
            area: course.area,
            level: course.level,
            tuition_band: course.tuition_band,
            english_bar: course.english_bar,
            active: true,
        });
    }
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
    item.attempt = item
        .attempt
        .checked_add(1)
        .expect("work item attempt exhausted");
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
        validate_identifier(value, "invalid run identifier")
            .unwrap_or_else(|error| panic!("{error}"));
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
    let mut control = ctx
        .db
        .workspace_work_control()
        .work_item_id()
        .find(&work_item_id)
        .expect("work item control not found");
    let set_id = item.work_set_id.clone();
    if item.kind == "course_fit_summary" {
        let expected: CourseSummaryDependencies = serde_json::from_str(&control.dependency_json)
            .unwrap_or_else(|_| panic!("invalid course summary dependencies"));
        let Some(current) = current_course_summary_dependencies(ctx, &item) else {
            item.status = "obsolete".into();
            item.worker_id = None;
            item.lease_until_micros = None;
            item.error_code = Some("dependencies_unavailable".into());
            ctx.db.workspace_work_item().work_item_id().update(item);
            refresh_work_set_status(ctx, &set_id);
            return;
        };
        if expected != current {
            refresh_course_summary_input(&mut item, &mut control, &current)
                .unwrap_or_else(|error| panic!("{error}"));
            item.status = "retrying".into();
            item.worker_id = None;
            item.lease_until_micros = None;
            item.error_code = Some("dependencies_changed".into());
            item.expected_context_revision = ctx
                .db
                .conversation()
                .conversation_id()
                .find(&item.conversation_id)
                .expect("conversation not found")
                .context_revision;
            ctx.db
                .workspace_work_control()
                .work_item_id()
                .update(control);
            ctx.db.workspace_work_item().work_item_id().update(item);
            refresh_work_set_status(ctx, &set_id);
            return;
        }
    }

    let label = summary_action_label(&control, &result_json);
    ctx.db.workspace_result().insert(WorkspaceResult {
        work_item_id: item.work_item_id.clone(),
        work_set_id: set_id.clone(),
        conversation_id: item.conversation_id.clone(),
        result_revision: 1,
        result_json,
        run_id,
        completed_at_micros: now,
    });
    let work_set = ctx
        .db
        .workspace_work_set()
        .work_set_id()
        .find(&set_id)
        .expect("work set not found");
    let origin = ctx
        .db
        .turn_ui_origin()
        .turn_id()
        .find(&work_set.source_turn_id)
        .expect("turn UI origin not found");
    create_ui_action(
        ctx,
        &origin,
        "work_item",
        &item.work_item_id,
        "open_course_summary",
        label,
        "Open summary",
        control.target_json,
    );
    item.status = "completed".into();
    item.lease_until_micros = None;
    ctx.db.workspace_work_item().work_item_id().update(item);
    refresh_work_set_status(ctx, &set_id);
}

#[spacetimedb::reducer]
pub fn publish_ui_state(
    ctx: &ReducerContext,
    conversation_id: String,
    client_instance_id: String,
    target_json: String,
    visible: bool,
) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&client_instance_id, "invalid UI client identifier")
        .unwrap_or_else(|error| panic!("{error}"));
    ensure_member(ctx, &conversation_id);
    validate_resolvable_ui_target(ctx, &conversation_id, &target_json)
        .unwrap_or_else(|error| panic!("{error}"));
    let principal_id = caller(ctx);
    let state_id = ui_state_id(&principal_id, &conversation_id, &client_instance_id);
    let now = now_micros(ctx);
    if let Some(mut state) = ctx.db.user_ui_state().state_id().find(&state_id) {
        if state.target_json != target_json {
            state.navigation_revision = state
                .navigation_revision
                .checked_add(1)
                .expect("UI navigation revision exhausted");
            state.target_json = target_json;
        }
        state.visible = visible;
        state.last_seen_at_micros = now;
        ctx.db.user_ui_state().state_id().update(state);
    } else {
        ctx.db.user_ui_state().insert(UserUiState {
            state_id,
            conversation_id,
            principal_id,
            client_instance_id,
            target_json,
            navigation_revision: 0,
            visible,
            last_seen_at_micros: now,
        });
    }
}

#[spacetimedb::reducer]
pub fn publish_ui_presence(
    ctx: &ReducerContext,
    conversation_id: String,
    client_instance_id: String,
    visible: bool,
) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&client_instance_id, "invalid UI client identifier")
        .unwrap_or_else(|error| panic!("{error}"));
    ensure_member(ctx, &conversation_id);
    let principal_id = caller(ctx);
    let state_id = ui_state_id(&principal_id, &conversation_id, &client_instance_id);
    let mut state = ctx
        .db
        .user_ui_state()
        .state_id()
        .find(&state_id)
        .expect("UI state not found");
    state.visible = visible;
    state.last_seen_at_micros = now_micros(ctx);
    ctx.db.user_ui_state().state_id().update(state);
}

#[spacetimedb::reducer]
pub fn resolve_auto_ui_action(ctx: &ReducerContext, conversation_id: String, action_id: String) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&action_id, "invalid UI action identifier")
        .unwrap_or_else(|error| panic!("{error}"));
    ensure_member(ctx, &conversation_id);
    let principal_id = caller(ctx);
    let mut action = ctx
        .db
        .ui_action()
        .action_id()
        .find(&action_id)
        .expect("UI action not found");
    if action.conversation_id != conversation_id || action.principal_id != principal_id {
        panic!("UI action does not belong to the caller");
    }
    if action.status != "auto_pending" {
        return;
    }
    let state_id = ui_state_id(&principal_id, &conversation_id, &action.client_instance_id);
    let mut state = ctx
        .db
        .user_ui_state()
        .state_id()
        .find(&state_id)
        .expect("originating UI state not found");
    let now = now_micros(ctx);
    let unchanged = state.navigation_revision == action.base_navigation_revision
        && state.target_json == action.base_target_json
        && state.visible
        && now.saturating_sub(state.last_seen_at_micros) <= UI_STATE_FRESH_MICROS;
    if unchanged {
        state.navigation_revision = state
            .navigation_revision
            .checked_add(1)
            .expect("UI navigation revision exhausted");
        state.target_json = action.target_json.clone();
        state.last_seen_at_micros = now;
        ctx.db.user_ui_state().state_id().update(state);
        action.status = "applied".into();
    } else {
        action.status = "offered".into();
    }
    action.updated_at_micros = now;
    ctx.db.ui_action().action_id().update(action);
}

#[spacetimedb::reducer]
pub fn open_ui_action(
    ctx: &ReducerContext,
    conversation_id: String,
    action_id: String,
    client_instance_id: String,
) {
    validate_conversation_id(&conversation_id).unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&action_id, "invalid UI action identifier")
        .unwrap_or_else(|error| panic!("{error}"));
    validate_identifier(&client_instance_id, "invalid UI client identifier")
        .unwrap_or_else(|error| panic!("{error}"));
    ensure_member(ctx, &conversation_id);
    let principal_id = caller(ctx);
    let mut action = ctx
        .db
        .ui_action()
        .action_id()
        .find(&action_id)
        .expect("UI action not found");
    if action.conversation_id != conversation_id || action.principal_id != principal_id {
        panic!("UI action does not belong to the caller");
    }
    let state_id = ui_state_id(&principal_id, &conversation_id, &client_instance_id);
    let mut state = ctx
        .db
        .user_ui_state()
        .state_id()
        .find(&state_id)
        .expect("UI state not found");
    let now = now_micros(ctx);
    state.navigation_revision = state
        .navigation_revision
        .checked_add(1)
        .expect("UI navigation revision exhausted");
    state.target_json = action.target_json.clone();
    state.visible = true;
    state.last_seen_at_micros = now;
    ctx.db.user_ui_state().state_id().update(state);
    action.status = "opened".into();
    action.updated_at_micros = now;
    ctx.db.ui_action().action_id().update(action);
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
        .filter_map(|conversation_id| {
            ctx.db
                .conversation()
                .conversation_id()
                .find(&conversation_id)
        })
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

#[spacetimedb::view(accessor = my_workspace_work_controls, public)]
fn my_workspace_work_controls(ctx: &ViewContext) -> Vec<WorkspaceWorkControl> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .workspace_work_control()
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

#[spacetimedb::view(accessor = my_user_ui_states, public)]
fn my_user_ui_states(ctx: &ViewContext) -> Vec<UserUiState> {
    let principal_id = ctx.sender().to_string();
    ctx.db
        .user_ui_state()
        .principal_id()
        .filter(&principal_id)
        .collect()
}

#[spacetimedb::view(accessor = my_ui_actions, public)]
fn my_ui_actions(ctx: &ViewContext) -> Vec<UiAction> {
    let principal_id = ctx.sender().to_string();
    ctx.db
        .ui_action()
        .principal_id()
        .filter(&principal_id)
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

#[spacetimedb::view(accessor = my_conversation_profiles, public)]
fn my_conversation_profiles(ctx: &ViewContext) -> Vec<ConversationProfile> {
    caller_conversation_ids(ctx)
        .into_iter()
        .filter_map(|conversation_id| {
            ctx.db
                .conversation_profile()
                .conversation_id()
                .find(&conversation_id)
        })
        .collect()
}

#[spacetimedb::view(accessor = my_turn_updates, public)]
fn my_turn_updates(ctx: &ViewContext) -> Vec<TurnUpdate> {
    caller_conversation_ids(ctx)
        .into_iter()
        .flat_map(|conversation_id| {
            let mut rows: Vec<_> = ctx
                .db
                .turn_update()
                .conversation_id()
                .filter(&conversation_id)
                .collect();
            rows.sort_by(|left, right| right.update_id.cmp(&left.update_id));
            rows.truncate(MAX_TURN_UPDATES_PER_CONVERSATION);
            rows
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
            let message = ctx.db.message().message_id().find(&job.user_message_id)?;
            let origin = ctx.db.turn_ui_origin().turn_id().find(&job.turn_id)?;
            Some(WorkerPendingTurn {
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
                ui_client_instance_id: origin.client_instance_id,
                ui_target_json: origin.target_json,
                ui_navigation_revision: origin.navigation_revision,
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
        .filter_map(|item| {
            let control = ctx
                .db
                .workspace_work_control()
                .work_item_id()
                .find(&item.work_item_id)?;
            let work_set = ctx
                .db
                .workspace_work_set()
                .work_set_id()
                .find(&item.work_set_id)?;
            let origin = ctx
                .db
                .turn_ui_origin()
                .turn_id()
                .find(&work_set.source_turn_id)?;
            Some(WorkerPendingWorkItem {
                work_item_id: item.work_item_id,
                work_set_id: item.work_set_id,
                conversation_id: item.conversation_id,
                entity_type: item.entity_type,
                entity_id: item.entity_id,
                kind: item.kind,
                display_title: control.display_title,
                order_index: control.order_index,
                target_json: control.target_json,
                dependency_json: control.dependency_json,
                input_json: item.input_json,
                status: item.status,
                lease_until_micros: item.lease_until_micros,
                attempt: item.attempt,
                expected_context_revision: item.expected_context_revision,
                expected_ui_revision: item.expected_ui_revision,
                ui_client_instance_id: origin.client_instance_id,
                ui_target_json: origin.target_json,
                ui_navigation_revision: origin.navigation_revision,
            })
        })
        .collect()
}

#[spacetimedb::view(accessor = worker_user_ui_states, public)]
fn worker_user_ui_states(ctx: &ViewContext) -> Vec<UserUiState> {
    if !is_registered_worker_view(ctx) {
        return vec![];
    }
    let mut conversation_ids = std::collections::HashSet::new();
    for status in ["pending", "retrying", "claimed"] {
        for job in ctx.db.turn_job().status().filter(status) {
            conversation_ids.insert(job.conversation_id);
        }
        for item in ctx.db.workspace_work_item().status().filter(status) {
            conversation_ids.insert(item.conversation_id);
        }
    }
    conversation_ids
        .into_iter()
        .flat_map(|conversation_id| {
            ctx.db
                .user_ui_state()
                .conversation_id()
                .filter(&conversation_id)
                .collect::<Vec<_>>()
        })
        .collect()
}

#[spacetimedb::view(accessor = worker_conversation_profiles, public)]
fn worker_conversation_profiles(ctx: &ViewContext) -> Vec<ConversationProfile> {
    if !is_registered_worker_view(ctx) {
        return vec![];
    }
    let mut conversation_ids = std::collections::HashSet::new();
    for status in ["pending", "retrying", "claimed"] {
        for job in ctx.db.turn_job().status().filter(status) {
            conversation_ids.insert(job.conversation_id);
        }
        for item in ctx.db.workspace_work_item().status().filter(status) {
            conversation_ids.insert(item.conversation_id);
        }
    }
    conversation_ids
        .into_iter()
        .filter_map(|conversation_id| {
            ctx.db
                .conversation_profile()
                .conversation_id()
                .find(&conversation_id)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::{
        CATALOG_VIEW, DISCOVERY_VIEW, TurnJob, UiTargetRef, WorkItemSpec, WorkspaceWorkItem,
        lease_is_expired, lease_owner_matches, turn_is_claimable, validate_command_id,
        validate_conversation_id, validate_directive, validate_directive_revision,
        validate_error_code, validate_message_content, validate_turn_update,
        validate_ui_target_json, validate_work_item_spec, validate_work_item_target,
        work_item_is_claimable, work_item_lease_owner_matches,
    };

    fn turn(
        status: &str,
        worker_id: Option<&str>,
        lease_until_micros: Option<i64>,
        attempt: u32,
    ) -> TurnJob {
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

    fn work_item(
        status: &str,
        worker_id: Option<&str>,
        lease_until_micros: Option<i64>,
        attempt: u32,
    ) -> WorkspaceWorkItem {
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
        assert!(
            validate_work_item_spec(&WorkItemSpec {
                entity_type: "discovery_topic".into(),
                entity_id: "goals".into(),
                kind: "advisor_prompt".into(),
                display_title: "Preparing goals".into(),
                order_index: 0,
                target_json: r#"{"schemaVersion":1,"viewType":"catalog"}"#.into(),
                dependency_json: "{}".into(),
                input_json: "{}".into(),
            })
            .is_ok()
        );
        assert!(validate_ui_target_json(r#"{"schemaVersion":1,"viewType":"home"}"#).is_ok());
        assert!(validate_ui_target_json(r#"{"schemaVersion":1,"viewType":"course_summary","entityType":"course","entityId":"course-1"}"#).is_err());
        assert!(
            validate_ui_target_json(r#"{"schemaVersion":1,"viewType":"react_component"}"#).is_err()
        );

        let course_spec = WorkItemSpec {
            entity_type: "course".into(),
            entity_id: "course-1".into(),
            kind: "course_fit_summary".into(),
            display_title: "Comparing Course 1".into(),
            order_index: 0,
            target_json: r#"{"schemaVersion":1,"viewType":"course_summary","workSetId":"turn-1-work","entityType":"course","entityId":"course-1","slot":"summary"}"#.into(),
            dependency_json: r#"{"profile":{"background":"","courseInterests":"","ambitions":"","primaryArea":"","candidateAreas":[],"studentPhrase":"","constraintsText":""},"course":{"courseId":"course-1","institutionId":"institution-1","institutionName":"Institution","country":"Country","city":"City","name":"Course 1","area":"computing","level":"bachelor","tuitionBand":"","englishBar":""}}"#.into(),
            input_json: "{}".into(),
        };
        assert!(validate_work_item_target(&course_spec, "turn-1-work").is_ok());
        let mut mismatched = course_spec;
        mismatched.target_json = r#"{"schemaVersion":1,"viewType":"course_summary","workSetId":"turn-1-work","entityType":"course","entityId":"course-2","slot":"summary"}"#.into();
        assert!(validate_work_item_target(&mismatched, "turn-1-work").is_err());
    }

    #[test]
    fn accepts_discovery_and_catalog_directive_contracts() {
        assert!(validate_directive(1, DISCOVERY_VIEW, "Ready to help.").is_ok());
        assert!(
            validate_directive(1, CATALOG_VIEW, "Showing courses related to programming.").is_ok()
        );
        assert!(validate_directive(2, DISCOVERY_VIEW, "Ready").is_err());
        assert!(validate_directive(1, "compare", "Ready").is_err());
        assert!(validate_directive(1, DISCOVERY_VIEW, &"x".repeat(513)).is_err());
        assert!(validate_turn_update("turn_started", "{}").is_ok());
        assert!(
            validate_turn_update(
                "course_search_started",
                r#"{"studentPhrase":"programming"}"#
            )
            .is_ok()
        );
        assert!(validate_turn_update("unknown", "{}").is_err());
    }

    #[test]
    fn omits_empty_optional_fields_from_ui_targets() {
        let target = UiTargetRef {
            schema_version: 1,
            view_type: "catalog".into(),
            work_set_id: Some("turn-1-work".into()),
            entity_type: None,
            entity_id: None,
            slot: None,
        };
        assert_eq!(
            serde_json::to_string(&target).expect("target must serialize"),
            r#"{"schemaVersion":1,"viewType":"catalog","workSetId":"turn-1-work"}"#
        );
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
