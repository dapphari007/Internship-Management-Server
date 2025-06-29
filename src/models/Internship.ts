export interface Internship {
  id: string;
  company_id: string;
  title: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  skills_required: string[];
  location: string;
  location_type: 'remote' | 'onsite' | 'hybrid';
  duration: string;
  stipend?: number;
  application_deadline: Date;
  start_date: Date;
  end_date?: Date;
  status: 'draft' | 'published' | 'closed' | 'cancelled';
  positions_available: number;
  positions_filled: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateInternshipData {
  company_id: string;
  title: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  skills_required: string[];
  location: string;
  location_type: 'remote' | 'onsite' | 'hybrid';
  duration: string;
  stipend?: number;
  application_deadline: Date;
  start_date: Date;
  end_date?: Date;
  positions_available: number;
}

export interface UpdateInternshipData {
  title?: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  skills_required?: string[];
  location?: string;
  location_type?: 'remote' | 'onsite' | 'hybrid';
  duration?: string;
  stipend?: number;
  application_deadline?: Date;
  start_date?: Date;
  end_date?: Date;
  status?: 'draft' | 'published' | 'closed' | 'cancelled';
  positions_available?: number;
}