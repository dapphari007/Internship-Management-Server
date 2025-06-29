export interface UserPreferences {
  id: string;
  user_id: string;
  
  // Privacy settings
  profile_visibility: 'public' | 'registered' | 'private';
  show_email: boolean;
  show_phone: boolean;
  show_location: boolean;
  allow_messages: boolean;
  show_online_status: boolean;
  searchable: boolean;
  
  // Notification settings
  email_notifications: boolean;
  push_notifications: boolean;
  task_reminders: boolean;
  application_updates: boolean;
  message_notifications: boolean;
  weekly_digest: boolean;
  marketing_emails: boolean;
  sound_enabled: boolean;
  desktop_notifications: boolean;
  
  // Security settings
  two_factor_enabled: boolean;
  login_alerts: boolean;
  session_timeout: number;
  
  // Appearance settings
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  date_format: string;
  compact_mode: boolean;
  
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserPreferencesData {
  user_id: string;
  profile_visibility?: 'public' | 'registered' | 'private';
  show_email?: boolean;
  show_phone?: boolean;
  show_location?: boolean;
  allow_messages?: boolean;
  show_online_status?: boolean;
  searchable?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  task_reminders?: boolean;
  application_updates?: boolean;
  message_notifications?: boolean;
  weekly_digest?: boolean;
  marketing_emails?: boolean;
  sound_enabled?: boolean;
  desktop_notifications?: boolean;
  two_factor_enabled?: boolean;
  login_alerts?: boolean;
  session_timeout?: number;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  date_format?: string;
  compact_mode?: boolean;
}

export interface UpdateUserPreferencesData {
  profile_visibility?: 'public' | 'registered' | 'private';
  show_email?: boolean;
  show_phone?: boolean;
  show_location?: boolean;
  allow_messages?: boolean;
  show_online_status?: boolean;
  searchable?: boolean;
  email_notifications?: boolean;
  push_notifications?: boolean;
  task_reminders?: boolean;
  application_updates?: boolean;
  message_notifications?: boolean;
  weekly_digest?: boolean;
  marketing_emails?: boolean;
  sound_enabled?: boolean;
  desktop_notifications?: boolean;
  two_factor_enabled?: boolean;
  login_alerts?: boolean;
  session_timeout?: number;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  date_format?: string;
  compact_mode?: boolean;
}