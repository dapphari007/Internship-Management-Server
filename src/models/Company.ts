export interface Company {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string;
  website?: string;
  industry: string;
  company_size: string;
  location: string;
  founded_year?: number;
  logo_url?: string;
  banner_url?: string;
  contact_email: string;
  contact_phone?: string;
  linkedin_url?: string;
  twitter_url?: string;
  status: 'active' | 'inactive' | 'pending';
  verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCompanyData {
  user_id: string;
  name: string;
  description: string;
  website?: string;
  industry: string;
  company_size: string;
  location: string;
  founded_year?: number;
  contact_email: string;
  contact_phone?: string;
  linkedin_url?: string;
  twitter_url?: string;
}

export interface UpdateCompanyData {
  name?: string;
  description?: string;
  website?: string;
  industry?: string;
  company_size?: string;
  location?: string;
  founded_year?: number;
  logo_url?: string;
  banner_url?: string;
  contact_email?: string;
  contact_phone?: string;
  linkedin_url?: string;
  twitter_url?: string;
}