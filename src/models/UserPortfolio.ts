// Models for user portfolio items (experiences, projects, achievements)

export interface UserExperience {
  id: string;
  user_id: string;
  title: string;
  company: string;
  duration: string;
  description?: string;
  skills?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface UserProject {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  technologies?: string[];
  link?: string;
  status?: string;
  experience?: string;
  achievements?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  title: string;
  issuer: string;
  date?: string;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserExperienceData {
  title: string;
  company: string;
  duration: string;
  description?: string;
  skills?: string[];
}

export interface CreateUserProjectData {
  title: string;
  description?: string;
  technologies?: string[];
  link?: string;
  status?: string;
  experience?: string;
  achievements?: string;
}

export interface CreateUserAchievementData {
  title: string;
  issuer: string;
  date?: string;
  description?: string;
}

export interface UpdateUserExperienceData {
  title?: string;
  company?: string;
  duration?: string;
  description?: string;
  skills?: string[];
}

export interface UpdateUserProjectData {
  title?: string;
  description?: string;
  technologies?: string[];
  link?: string;
  status?: string;
  experience?: string;
  achievements?: string;
}

export interface UpdateUserAchievementData {
  title?: string;
  issuer?: string;
  date?: string;
  description?: string;
}