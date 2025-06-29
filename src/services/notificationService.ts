import pool from '../config/database.js';
import { sendNotificationToUser, broadcastNotificationToRole } from '../routes/notifications.js';

export class NotificationService {
  // Application status notifications
  static async notifyApplicationStatusChange(
    applicationId: string, 
    studentId: string, 
    status: string, 
    internshipTitle: string,
    companyName: string
  ) {
    let title = '';
    let message = '';
    let type: 'info' | 'success' | 'warning' | 'error' = 'info';

    switch (status) {
      case 'accepted':
        title = 'Application Accepted! 🎉';
        message = `Congratulations! Your application for "${internshipTitle}" at ${companyName} has been accepted.`;
        type = 'success';
        break;
      case 'rejected':
        title = 'Application Update';
        message = `Your application for "${internshipTitle}" at ${companyName} was not selected this time. Keep applying!`;
        type = 'info';
        break;
      case 'shortlisted':
        title = 'You\'ve been shortlisted! ⭐';
        message = `Great news! You've been shortlisted for "${internshipTitle}" at ${companyName}.`;
        type = 'success';
        break;
      case 'interview_scheduled':
        title = 'Interview Scheduled 📅';
        message = `Your interview for "${internshipTitle}" at ${companyName} has been scheduled.`;
        type = 'info';
        break;
      default:
        title = 'Application Status Update';
        message = `Your application status for "${internshipTitle}" at ${companyName} has been updated to ${status}.`;
    }

    await sendNotificationToUser(
      studentId,
      title,
      message,
      type,
      '/applications'
    );
  }

  // New internship posting notifications
  static async notifyNewInternshipPosting(internshipId: string, internshipTitle: string, companyName: string) {
    try {
      // Get the internship details
      const internshipResult = await pool.query(
        'SELECT * FROM internships WHERE id = $1',
        [internshipId]
      );

      if (internshipResult.rows.length === 0) {
        return;
      }

      const internship = internshipResult.rows[0];

      // Find students who might be interested based on their preferences/skills
      const studentsQuery = `
        SELECT DISTINCT u.id 
        FROM users u
        WHERE u.role = 'student'
        AND (
          u.skills::text ILIKE $1 OR 
          u.major ILIKE $2 OR
          u.location ILIKE $3 OR
          u.location IS NULL
        )
        LIMIT 100
      `;

      const skillsPattern = `%${internship.required_skills || ''}%`;
      const majorPattern = `%${internship.field || ''}%`;
      const location = internship.location || '';

      const studentsResult = await pool.query(studentsQuery, [skillsPattern, majorPattern, location]);

      // Send notifications to matching students
      for (const student of studentsResult.rows) {
        await sendNotificationToUser(
          student.id,
          'New Internship Opportunity! 🚀',
          `A new internship "${internshipTitle}" has been posted by ${companyName}. Check it out!`,
          'info',
          `/internships`
        );
      }

      // Also send to all students if no specific matches (fallback)
      if (studentsResult.rows.length === 0) {
        await broadcastNotificationToRole(
          'student',
          'New Internship Posted! 🚀',
          `${companyName} has posted a new internship: "${internshipTitle}". Check it out!`,
          'info',
          '/internships'
        );
      }

    } catch (error) {
      console.error('Error sending new internship notifications:', error);
    }
  }

  // Task deadline reminders
  static async notifyTaskDeadlineReminder(taskId: string, userId: string, taskTitle: string, daysUntilDeadline: number) {
    let title = '';
    let message = '';
    let type: 'warning' | 'error' = 'warning';

    if (daysUntilDeadline <= 0) {
      title = 'Task Overdue! ⚠️';
      message = `Your task "${taskTitle}" is overdue. Please complete it as soon as possible.`;
      type = 'error';
    } else if (daysUntilDeadline === 1) {
      title = 'Task Due Tomorrow! ⏰';
      message = `Your task "${taskTitle}" is due tomorrow. Don't forget to complete it!`;
      type = 'warning';
    } else {
      title = 'Task Deadline Reminder 📅';
      message = `Your task "${taskTitle}" is due in ${daysUntilDeadline} days.`;
      type = 'warning';
    }

    await sendNotificationToUser(
      userId,
      title,
      message,
      type,
      '/tasks'
    );
  }

  // Task completion notifications
  static async notifyTaskCompletion(userId: string, taskTitle: string) {
    await sendNotificationToUser(
      userId,
      'Task Completed! ✅',
      `Congratulations! You have successfully completed "${taskTitle}".`,
      'success',
      '/tasks'
    );
  }
  
  // Task rejection notifications
  static async notifyTaskRejection(userId: string, taskTitle: string) {
    await sendNotificationToUser(
      userId,
      'Task Submission Rejected ⚠️',
      `Your submission for "${taskTitle}" has been rejected. Please review the feedback and resubmit.`,
      'warning',
      '/tasks'
    );
  }

  // System announcements
  static async sendSystemAnnouncement(
    title: string, 
    message: string, 
    targetRole?: 'student' | 'company' | 'admin',
    actionUrl?: string
  ) {
    if (targetRole) {
      await broadcastNotificationToRole(targetRole, title, message, 'info', actionUrl);
    } else {
      // Send to all users
      const roles: ('student' | 'company' | 'admin')[] = ['student', 'company', 'admin'];
      for (const role of roles) {
        await broadcastNotificationToRole(role, title, message, 'info', actionUrl);
      }
    }
  }

  // Message notifications
  static async notifyNewMessage(recipientId: string, senderName: string, subject?: string) {
    const title = 'New Message 💬';
    const message = subject 
      ? `${senderName} sent you a message: "${subject}"`
      : `${senderName} sent you a message`;

    await sendNotificationToUser(
      recipientId,
      title,
      message,
      'info',
      '/messages'
    );
  }

  // Course enrollment notifications
  static async notifyCourseEnrollment(userId: string, courseTitle: string) {
    await sendNotificationToUser(
      userId,
      'Course Enrollment Successful! 📚',
      `You have successfully enrolled in "${courseTitle}". Start learning now!`,
      'success',
      '/learning'
    );
  }

  // Periodic task to check for deadline reminders
  static async checkTaskDeadlines() {
    try {
      const query = `
        SELECT t.id, t.title, t.due_date, t.student_id as user_id
        FROM tasks t
        WHERE t.status NOT IN ('completed', 'submitted')
        AND t.due_date IS NOT NULL
        AND t.due_date > NOW()
        AND t.due_date <= NOW() + INTERVAL '3 days'
      `;

      const result = await pool.query(query);

      for (const task of result.rows) {
        const daysUntilDeadline = Math.ceil(
          (new Date(task.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we already sent a reminder for this deadline period
        const reminderCheck = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
           AND message ILIKE $2 
           AND created_at > NOW() - INTERVAL '1 day'`,
          [task.user_id, `%${task.title}%`]
        );

        if (reminderCheck.rows.length === 0) {
          await this.notifyTaskDeadlineReminder(task.id, task.user_id, task.title, daysUntilDeadline);
        }
      }
    } catch (error) {
      console.error('Error checking task deadlines:', error);
    }
  }

  // Company-specific notifications
  static async notifyNewApplication(companyUserId: string, applicationData: {
    studentName: string;
    internshipTitle: string;
    applicationId: string;
    internshipId: string;
  }) {
    await sendNotificationToUser(
      companyUserId,
      'New Application Received! 📝',
      `${applicationData.studentName} has applied for "${applicationData.internshipTitle}". Review their application now.`,
      'info',
      `/applications?highlight=${applicationData.applicationId}`
    );
  }

  static async notifyInternshipDeadlineApproaching(companyUserId: string, internshipData: {
    internshipTitle: string;
    internshipId: string;
    daysUntilDeadline: number;
  }) {
    const urgencyType = internshipData.daysUntilDeadline <= 1 ? 'error' : 
                       internshipData.daysUntilDeadline <= 3 ? 'warning' : 'info';
    
    let title = '';
    let message = '';

    if (internshipData.daysUntilDeadline <= 0) {
      title = 'Internship Deadline Passed! ⚠️';
      message = `The application deadline for "${internshipData.internshipTitle}" has passed. Consider extending or closing applications.`;
    } else if (internshipData.daysUntilDeadline === 1) {
      title = 'Internship Deadline Tomorrow! ⏰';
      message = `The application deadline for "${internshipData.internshipTitle}" is tomorrow.`;
    } else {
      title = 'Internship Deadline Reminder 📅';
      message = `The application deadline for "${internshipData.internshipTitle}" is in ${internshipData.daysUntilDeadline} days.`;
    }

    await sendNotificationToUser(
      companyUserId,
      title,
      message,
      urgencyType,
      `/my-internships?highlight=${internshipData.internshipId}`
    );
  }

  static async notifyLowApplicationCount(companyUserId: string, internshipData: {
    internshipTitle: string;
    internshipId: string;
    applicationCount: number;
    daysActive: number;
  }) {
    await sendNotificationToUser(
      companyUserId,
      'Low Application Count 📊',
      `Your internship "${internshipData.internshipTitle}" has only received ${internshipData.applicationCount} applications in ${internshipData.daysActive} days. Consider reviewing the job description or requirements.`,
      'warning',
      `/my-internships?highlight=${internshipData.internshipId}`
    );
  }

  static async notifyInternshipPublished(companyUserId: string, internshipData: {
    internshipTitle: string;
    internshipId: string;
  }) {
    await sendNotificationToUser(
      companyUserId,
      'Internship Published Successfully! ✅',
      `Your internship "${internshipData.internshipTitle}" has been published and is now visible to students.`,
      'success',
      `/my-internships?highlight=${internshipData.internshipId}`
    );
  }

  static async notifyApplicationDeadlineReminder(companyUserId: string, applicationData: {
    studentName: string;
    internshipTitle: string;
    applicationId: string;
    daysPending: number;
  }) {
    await sendNotificationToUser(
      companyUserId,
      'Pending Application Reminder 🔔',
      `${applicationData.studentName}'s application for "${applicationData.internshipTitle}" has been pending for ${applicationData.daysPending} days. Consider reviewing it soon.`,
      'warning',
      `/applications?highlight=${applicationData.applicationId}`
    );
  }

  static async notifyCompanyProfileView(companyUserId: string, viewData: {
    studentName: string;
    studentId: string;
    viewCount: number;
  }) {
    await sendNotificationToUser(
      companyUserId,
      'Company Profile Viewed 👀',
      `${viewData.studentName} viewed your company profile${viewData.viewCount > 1 ? ` (${viewData.viewCount} times this week)` : ''}.`,
      'info',
      `/students?highlight=${viewData.studentId}`
    );
  }

  // Enhanced periodic checks for companies
  static async checkInternshipDeadlines() {
    try {
      const query = `
        SELECT i.id, i.title, i.application_deadline, c.user_id as company_user_id
        FROM internships i
        JOIN companies c ON i.company_id = c.id
        WHERE i.status = 'published'
        AND i.application_deadline IS NOT NULL
        AND i.application_deadline > NOW()
        AND i.application_deadline <= NOW() + INTERVAL '7 days'
      `;

      const result = await pool.query(query);

      for (const internship of result.rows) {
        const daysUntilDeadline = Math.ceil(
          (new Date(internship.application_deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we already sent a reminder for this deadline period
        const reminderCheck = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
           AND message ILIKE $2 
           AND created_at > NOW() - INTERVAL '1 day'`,
          [internship.company_user_id, `%${internship.title}%deadline%`]
        );

        if (reminderCheck.rows.length === 0) {
          await this.notifyInternshipDeadlineApproaching(internship.company_user_id, {
            internshipTitle: internship.title,
            internshipId: internship.id,
            daysUntilDeadline
          });
        }
      }
    } catch (error) {
      console.error('Error checking internship deadlines:', error);
    }
  }

  static async checkLowApplicationCounts() {
    try {
      const query = `
        SELECT i.id, i.title, i.created_at, c.user_id as company_user_id,
               (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as application_count
        FROM internships i
        JOIN companies c ON i.company_id = c.id
        WHERE i.status = 'published'
        AND i.created_at <= NOW() - INTERVAL '7 days'
        AND (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) < 5
      `;

      const result = await pool.query(query);

      for (const internship of result.rows) {
        const daysActive = Math.ceil(
          (new Date().getTime() - new Date(internship.created_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we already sent a low application warning
        const warningCheck = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
           AND message ILIKE $2 
           AND created_at > NOW() - INTERVAL '7 days'`,
          [internship.company_user_id, `%${internship.title}%low%application%`]
        );

        if (warningCheck.rows.length === 0) {
          await this.notifyLowApplicationCount(internship.company_user_id, {
            internshipTitle: internship.title,
            internshipId: internship.id,
            applicationCount: parseInt(internship.application_count),
            daysActive
          });
        }
      }
    } catch (error) {
      console.error('Error checking low application counts:', error);
    }
  }

  static async checkPendingApplications() {
    try {
      const query = `
        SELECT a.id, a.applied_at, u.full_name as student_name, i.title as internship_title,
               c.user_id as company_user_id
        FROM applications a
        JOIN users u ON a.student_id = u.id
        JOIN internships i ON a.internship_id = i.id
        JOIN companies c ON i.company_id = c.id
        WHERE a.status = 'pending'
        AND a.applied_at <= NOW() - INTERVAL '7 days'
      `;

      const result = await pool.query(query);

      for (const application of result.rows) {
        const daysPending = Math.ceil(
          (new Date().getTime() - new Date(application.applied_at).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Check if we already sent a pending reminder
        const reminderCheck = await pool.query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
           AND message ILIKE $2 
           AND created_at > NOW() - INTERVAL '3 days'`,
          [application.company_user_id, `%${application.student_name}%pending%`]
        );

        if (reminderCheck.rows.length === 0) {
          await this.notifyApplicationDeadlineReminder(application.company_user_id, {
            studentName: application.student_name,
            internshipTitle: application.internship_title,
            applicationId: application.id,
            daysPending
          });
        }
      }
    } catch (error) {
      console.error('Error checking pending applications:', error);
    }
  }

  // Start periodic checks (call this when server starts)
  static startPeriodicChecks() {
    console.log('🔔 Starting notification service periodic checks...');
    
    // Use a more efficient approach with a single interval
    // and staggered checks to prevent database overload
    let checkCounter = 0;
    
    const periodicCheck = setInterval(() => {
      // Every hour (checkCounter % 1 === 0)
      if (checkCounter % 1 === 0) {
        console.log('Running task deadline check...');
        this.checkTaskDeadlines().catch(err => {
          console.error('Error in task deadline check:', err);
        });
      }
      
      // Every 6 hours (checkCounter % 6 === 0)
      if (checkCounter % 6 === 0) {
        console.log('Running internship deadline check...');
        this.checkInternshipDeadlines().catch(err => {
          console.error('Error in internship deadline check:', err);
        });
      }
      
      // Every 12 hours (checkCounter % 12 === 0)
      if (checkCounter % 12 === 0) {
        console.log('Running pending applications check...');
        this.checkPendingApplications().catch(err => {
          console.error('Error in pending applications check:', err);
        });
      }
      
      // Every 24 hours (checkCounter % 24 === 0)
      if (checkCounter % 24 === 0) {
        console.log('Running low application counts check...');
        this.checkLowApplicationCounts().catch(err => {
          console.error('Error in low application counts check:', err);
        });
        
        // Reset counter after a full day
        checkCounter = 0;
      }
      
      checkCounter++;
    }, 60 * 60 * 1000); // Run every hour
    
    // Add error handling for the interval itself
    periodicCheck.unref(); // Allow the process to exit even if interval is still running
    
    // Initial checks with delay to prevent server startup overload
    setTimeout(() => {
      console.log('Running initial notification checks...');
      this.checkTaskDeadlines().catch(err => console.error('Error in initial task check:', err));
    }, 10000); // 10 seconds after startup
    
    setTimeout(() => {
      this.checkInternshipDeadlines().catch(err => console.error('Error in initial internship check:', err));
    }, 20000); // 20 seconds after startup
    
    setTimeout(() => {
      this.checkPendingApplications().catch(err => console.error('Error in initial applications check:', err));
    }, 30000); // 30 seconds after startup
    
    setTimeout(() => {
      this.checkLowApplicationCounts().catch(err => console.error('Error in initial application counts check:', err));
    }, 40000); // 40 seconds after startup
    
    console.log('🔔 Notification service periodic checks initialized');
  }
}

export default NotificationService;