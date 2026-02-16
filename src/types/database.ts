/**
 * Database Types for Session Planner
 *
 * These types are manually defined to match the Supabase schema.
 * For production, consider using `supabase gen types typescript` to auto-generate.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type OrgRole = 'admin' | 'member';
export type TeamRole = 'admin' | 'coach' | 'player' | 'parent';
export type PlayerStatus = 'active' | 'injured' | 'inactive';
export type EventType = 'practice' | 'game' | 'tournament' | 'other';
export type RsvpStatus = 'going' | 'not_going' | 'maybe' | 'pending';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type ChatType = 'team' | 'coaches' | 'direct' | 'group';
export type MessageType = 'text' | 'image' | 'file' | 'system';
export type AttachmentType = 'image' | 'video' | 'document' | 'audio';
export type RelationshipType = 'parent' | 'guardian' | 'other';
export type InvoiceStatus = 'draft' | 'open' | 'partially_paid' | 'paid' | 'void';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';
export type BillingInstallmentStatus = 'scheduled' | 'paid' | 'overdue' | 'void';
export type BillingReminderType = 'upcoming' | 'overdue';

// ============================================================================
// BASE TYPES
// ============================================================================

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  settings: Record<string, unknown>;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  settings: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface Team {
  id: string;
  organization_id: string | null;
  name: string;
  team_code: string;
  sport: string;
  logo_url: string | null;
  settings: TeamSettings;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamSettings {
  allow_player_posts: boolean;
  allow_parent_posts: boolean;
  show_attendance_to_players: boolean;
  season_end_date: string | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  jersey_number: string | null;
  position: string | null;
  status: PlayerStatus;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  user_id: string | null;
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number: string | null;
  position: string | null;
  grade: string | null;
  birth_date: string | null;
  medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  status: PlayerStatus;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ParentPlayerLink {
  id: string;
  parent_user_id: string;
  player_id: string;
  relationship: RelationshipType;
  can_rsvp: boolean;
  receives_notifications: boolean;
  created_at: string;
}

// ============================================================================
// DRILL TYPES
// ============================================================================

export interface DrillCategory {
  id: string;
  team_id: string | null;
  organization_id: string | null;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
}

export interface Drill {
  id: string;
  team_id: string | null;
  organization_id: string | null;
  category_id: string | null;
  name: string;
  description: string | null;
  default_duration: number;
  notes: string | null;
  tags: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DrillMedia {
  id: string;
  drill_id: string;
  type: AttachmentType;
  url: string;
  filename: string | null;
  size_bytes: number | null;
  created_at: string;
}

// ============================================================================
// SESSION TYPES
// ============================================================================

export interface Session {
  id: string;
  team_id: string;
  name: string;
  date: string | null;
  start_time: string | null;
  duration: number | null;
  location: string | null;
  defensive_emphasis: string | null;
  offensive_emphasis: string | null;
  quote: string | null;
  announcements: string | null;
  is_template: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionActivity {
  id: string;
  session_id: string;
  drill_id: string | null;
  sort_order: number;
  name: string;
  duration: number;
  category_id: string | null;
  notes: string | null;
  groups: ActivityGroup[];
  created_at: string;
  updated_at: string;
}

export interface ActivityGroup {
  name: string;
  player_ids: string[];
}

// ============================================================================
// EVENT TYPES
// ============================================================================

export interface Event {
  id: string;
  team_id: string;
  type: EventType;
  title: string;
  description: string | null;
  location: string | null;
  start_time: string;
  meet_time: string | null;
  end_time: string | null;
  duration: number | null;
  session_id: string | null;
  rsvp_limit: number | null;
  rsvp_deadline: string | null;
  opponent: string | null;
  repeat_rule: RepeatRule | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RepeatRule {
  frequency: 'weekly' | 'biweekly' | 'monthly';
  until: string | null;
  days_of_week?: number[];
}

export interface Rsvp {
  id: string;
  event_id: string;
  user_id: string | null;
  player_id: string | null;
  status: RsvpStatus;
  response_note: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  event_id: string;
  user_id: string | null;
  player_id: string | null;
  status: AttendanceStatus;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
}

// ============================================================================
// BILLING TYPES
// ============================================================================

export interface BillingInvoice {
  id: string;
  team_id: string;
  title: string;
  description: string | null;
  amount_cents: number;
  currency: string;
  due_date: string | null;
  status: InvoiceStatus;
  allow_partial: boolean;
  installment_plan_count: number;
  installment_frequency_days: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingInvoiceRecipient {
  id: string;
  invoice_id: string;
  user_id: string;
  amount_override_cents: number | null;
  created_at: string;
}

export interface BillingPayment {
  id: string;
  invoice_id: string;
  user_id: string;
  amount_cents: number;
  status: PaymentStatus;
  provider: string;
  provider_checkout_session_id: string | null;
  provider_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingInstallment {
  id: string;
  invoice_id: string;
  installment_number: number;
  due_date: string;
  created_at: string;
}

export interface BillingRecipientInstallment {
  id: string;
  invoice_id: string;
  installment_id: string;
  user_id: string;
  due_date: string;
  amount_cents: number;
  status: BillingInstallmentStatus;
  paid_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingReminder {
  id: string;
  team_id: string;
  invoice_id: string;
  recipient_installment_id: string | null;
  user_id: string;
  reminder_type: BillingReminderType;
  message: string;
  sent_by: string | null;
  sent_at: string;
  sent_on: string;
  is_read: boolean;
  read_at: string | null;
}

// ============================================================================
// POST TYPES
// ============================================================================

export interface Post {
  id: string;
  team_id: string;
  author_id: string;
  content: string;
  pinned: boolean;
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostAttachment {
  id: string;
  post_id: string;
  type: AttachmentType;
  url: string;
  filename: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PostView {
  id: string;
  post_id: string;
  user_id: string;
  viewed_at: string;
}

// ============================================================================
// CHAT TYPES
// ============================================================================

export interface Conversation {
  id: string;
  team_id: string | null;
  type: ChatType;
  name: string | null;
  icon_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string | null;
  is_muted: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: MessageType;
  metadata: MessageMetadata;
  created_at: string;
  updated_at: string;
}

export interface MessageMetadata {
  file_url?: string;
  file_name?: string;
  file_size?: number;
  image_width?: number;
  image_height?: number;
  thumbnail_url?: string;
}

// ============================================================================
// JOINED/EXTENDED TYPES (for queries with relations)
// ============================================================================

export interface TeamMemberWithProfile extends TeamMember {
  profile: Profile;
}

export interface TeamWithMembers extends Team {
  team_members: TeamMemberWithProfile[];
}

export interface PlayerWithParents extends Player {
  parent_links: (ParentPlayerLink & { parent: Profile })[];
}

export interface DrillWithCategory extends Drill {
  category: DrillCategory | null;
  media: DrillMedia[];
}

export interface SessionWithActivities extends Session {
  activities: (SessionActivity & { drill: Drill | null; category: DrillCategory | null })[];
}

export interface EventWithRsvps extends Event {
  rsvps: (Rsvp & { user: Profile | null; player: Player | null })[];
  session: Session | null;
}

export interface PostWithDetails extends Post {
  author: Profile;
  attachments: PostAttachment[];
  reactions: (Reaction & { user: Profile })[];
  comments: (Comment & { author: Profile })[];
  view_count: number;
}

export interface ConversationWithParticipants extends Conversation {
  participants: (ConversationParticipant & { user: Profile })[];
  last_message: Message | null;
  unread_count: number;
}

export interface MessageWithSender extends Message {
  sender: Profile;
}

// ============================================================================
// INPUT TYPES (for creating/updating records)
// ============================================================================

export interface CreateTeamInput {
  name: string;
  organization_id?: string;
  sport?: string;
  logo_url?: string;
}

export interface CreatePlayerInput {
  team_id: string;
  first_name: string;
  last_name: string;
  jersey_number?: string;
  position?: string;
  grade?: string;
  birth_date?: string;
}

export interface CreateDrillInput {
  team_id?: string;
  organization_id?: string;
  category_id?: string;
  name: string;
  description?: string;
  default_duration?: number;
  notes?: string;
  tags?: string[];
}

export interface CreateSessionInput {
  team_id: string;
  name: string;
  date?: string;
  start_time?: string;
  duration?: number;
  location?: string;
  defensive_emphasis?: string;
  offensive_emphasis?: string;
  quote?: string;
  announcements?: string;
  is_template?: boolean;
}

export interface CreateActivityInput {
  session_id: string;
  drill_id?: string;
  sort_order: number;
  name: string;
  duration: number;
  category_id?: string;
  notes?: string;
  groups?: ActivityGroup[];
}

export interface CreateEventInput {
  team_id: string;
  type: EventType;
  title: string;
  description?: string;
  location?: string;
  start_time: string;
  meet_time?: string;
  end_time?: string;
  duration?: number;
  session_id?: string;
  rsvp_limit?: number;
  rsvp_deadline?: string;
  opponent?: string;
}

export interface CreatePostInput {
  team_id: string;
  content: string;
}

export interface CreateMessageInput {
  conversation_id: string;
  content?: string;
  type?: MessageType;
  metadata?: MessageMetadata;
}

export interface CreateBillingInvoiceInput {
  team_id: string;
  title: string;
  description?: string;
  amount_cents: number;
  currency?: string;
  due_date?: string;
  allow_partial?: boolean;
  installment_count?: number;
  installment_frequency_days?: number;
  first_installment_due_date?: string;
  recipient_user_ids: string[];
}

// ============================================================================
// SUPABASE DATABASE TYPE (for client type safety)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>;
      };
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Organization, 'id' | 'created_at'>>;
      };
      organization_members: {
        Row: OrganizationMember;
        Insert: Omit<OrganizationMember, 'id' | 'created_at'>;
        Update: Partial<Omit<OrganizationMember, 'id' | 'created_at'>>;
      };
      teams: {
        Row: Team;
        Insert: Omit<Team, 'id' | 'team_code' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Team, 'id' | 'created_at'>>;
      };
      team_members: {
        Row: TeamMember;
        Insert: Omit<TeamMember, 'id' | 'joined_at' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<TeamMember, 'id' | 'created_at'>>;
      };
      players: {
        Row: Player;
        Insert: Omit<Player, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Player, 'id' | 'created_at'>>;
      };
      parent_player_links: {
        Row: ParentPlayerLink;
        Insert: Omit<ParentPlayerLink, 'id' | 'created_at'>;
        Update: Partial<Omit<ParentPlayerLink, 'id' | 'created_at'>>;
      };
      drill_categories: {
        Row: DrillCategory;
        Insert: Omit<DrillCategory, 'id' | 'created_at'>;
        Update: Partial<Omit<DrillCategory, 'id' | 'created_at'>>;
      };
      drills: {
        Row: Drill;
        Insert: Omit<Drill, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Drill, 'id' | 'created_at'>>;
      };
      drill_media: {
        Row: DrillMedia;
        Insert: Omit<DrillMedia, 'id' | 'created_at'>;
        Update: Partial<Omit<DrillMedia, 'id' | 'created_at'>>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Session, 'id' | 'created_at'>>;
      };
      session_activities: {
        Row: SessionActivity;
        Insert: Omit<SessionActivity, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<SessionActivity, 'id' | 'created_at'>>;
      };
      events: {
        Row: Event;
        Insert: Omit<Event, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Event, 'id' | 'created_at'>>;
      };
      rsvps: {
        Row: Rsvp;
        Insert: Omit<Rsvp, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Rsvp, 'id' | 'created_at'>>;
      };
      attendance_records: {
        Row: AttendanceRecord;
        Insert: Omit<AttendanceRecord, 'id' | 'recorded_at'>;
        Update: Partial<Omit<AttendanceRecord, 'id'>>;
      };
      billing_invoices: {
        Row: BillingInvoice;
        Insert: Omit<BillingInvoice, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BillingInvoice, 'id' | 'created_at'>>;
      };
      billing_invoice_recipients: {
        Row: BillingInvoiceRecipient;
        Insert: Omit<BillingInvoiceRecipient, 'id' | 'created_at'>;
        Update: Partial<Omit<BillingInvoiceRecipient, 'id' | 'created_at'>>;
      };
      billing_payments: {
        Row: BillingPayment;
        Insert: Omit<BillingPayment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BillingPayment, 'id' | 'created_at'>>;
      };
      billing_installments: {
        Row: BillingInstallment;
        Insert: Omit<BillingInstallment, 'id' | 'created_at'>;
        Update: Partial<Omit<BillingInstallment, 'id' | 'created_at'>>;
      };
      billing_recipient_installments: {
        Row: BillingRecipientInstallment;
        Insert: Omit<BillingRecipientInstallment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BillingRecipientInstallment, 'id' | 'created_at'>>;
      };
      billing_reminders: {
        Row: BillingReminder;
        Insert: Omit<BillingReminder, 'id' | 'sent_at' | 'sent_on'>;
        Update: Partial<Omit<BillingReminder, 'id' | 'sent_at' | 'sent_on'>>;
      };
      posts: {
        Row: Post;
        Insert: Omit<Post, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Post, 'id' | 'created_at'>>;
      };
      post_attachments: {
        Row: PostAttachment;
        Insert: Omit<PostAttachment, 'id' | 'created_at'>;
        Update: Partial<Omit<PostAttachment, 'id' | 'created_at'>>;
      };
      reactions: {
        Row: Reaction;
        Insert: Omit<Reaction, 'id' | 'created_at'>;
        Update: never;
      };
      comments: {
        Row: Comment;
        Insert: Omit<Comment, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Comment, 'id' | 'created_at'>>;
      };
      post_views: {
        Row: PostView;
        Insert: Omit<PostView, 'id' | 'viewed_at'>;
        Update: never;
      };
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Conversation, 'id' | 'created_at'>>;
      };
      conversation_participants: {
        Row: ConversationParticipant;
        Insert: Omit<ConversationParticipant, 'id' | 'joined_at'>;
        Update: Partial<Omit<ConversationParticipant, 'id' | 'joined_at'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Message, 'id' | 'created_at'>>;
      };
    };
    Functions: {
      is_team_member: {
        Args: { team_uuid: string };
        Returns: boolean;
      };
      is_team_admin_or_coach: {
        Args: { team_uuid: string };
        Returns: boolean;
      };
      is_org_admin: {
        Args: { org_uuid: string };
        Returns: boolean;
      };
      is_parent_of_player: {
        Args: { player_uuid: string };
        Returns: boolean;
      };
      get_or_create_dm: {
        Args: { other_user_id: string };
        Returns: string;
      };
      refresh_invoice_status: {
        Args: { invoice_uuid: string };
        Returns: void;
      };
    };
    Enums: {
      org_role: OrgRole;
      team_role: TeamRole;
      player_status: PlayerStatus;
      event_type: EventType;
      rsvp_status: RsvpStatus;
      attendance_status: AttendanceStatus;
      chat_type: ChatType;
      message_type: MessageType;
      attachment_type: AttachmentType;
      relationship_type: RelationshipType;
      invoice_status: InvoiceStatus;
      payment_status: PaymentStatus;
      billing_installment_status: BillingInstallmentStatus;
      billing_reminder_type: BillingReminderType;
    };
  };
}
