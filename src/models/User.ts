export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'student' | 'company' | 'admin';
  avatar_url?: string;
  phone?: string;
  location?: string;
  address?: string;
  bio?: string;
  website?: string;
  linkedin_url?: string;
  github_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  portfolio_url?: string;
  university?: string;
  major?: string;
  graduation_year?: string;
  gpa?: number;
  skills?: string[];
  interests?: string[];
  languages?: string[];
  company_name?: string;
  company_size?: string;
  industry?: string;
  company_description?: string;
  profile_complete: boolean;
  verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password: string;
  full_name: string;
  role: 'student' | 'company' | 'admin';
}

export interface UpdateUserData {
  full_name?: string;
  avatar_url?: string;
  phone?: string;
  location?: string;
  address?: string;
  bio?: string;
  website?: string;
  linkedin_url?: string;
  github_url?: string;
  instagram_url?: string;
  twitter_url?: string;
  portfolio_url?: string;
  university?: string;
  major?: string;
  graduation_year?: string;
  gpa?: number;
  skills?: string[];
  interests?: string[];
  languages?: string[];
  company_name?: string;
  company_size?: string;
  industry?: string;
  company_description?: string;
  verified?: boolean;
  check_profile_completion?: boolean;
}