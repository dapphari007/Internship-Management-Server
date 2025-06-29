export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  lessons: number;
  instructor: string;
  thumbnail?: string;
  course_url?: string;
  youtube_url?: string;
  skills: string[];
  is_active: boolean;
  certificate: boolean;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CourseLesson {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  duration: string;
  order_index: number;
  content_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  student_id: string;
  enrolled_at: Date;
  completed_at?: Date;
  progress: number;
  is_completed: boolean;
}

export interface CourseLessonProgress {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  completed_at?: Date;
  is_completed: boolean;
}

export interface CourseCertificate {
  id: string;
  enrollment_id: string;
  certificate_id: string;
  issued_at: Date;
  certificate_url?: string;
}

export interface CreateCourseData {
  title: string;
  description: string;
  category: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  lessons: number;
  instructor: string;
  thumbnail?: string;
  course_url?: string;
  youtube_url?: string;
  skills: string[];
  is_active?: boolean;
  certificate?: boolean;
}

export interface UpdateCourseData extends Partial<CreateCourseData> {}

export interface CreateLessonData {
  title: string;
  description?: string;
  duration: string;
  order_index: number;
  content_url?: string;
}

export interface CourseWithStats extends Course {
  enrolled_count: number;
  completed_count: number;
  rating?: number;
}

export interface CourseWithProgress extends Course {
  enrolled_count: number;
  is_enrolled: boolean;
  is_completed: boolean;
  progress: number;
  rating?: number;
}