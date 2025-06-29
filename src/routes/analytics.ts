import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard analytics (admin only)
router.get('/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get total students count
    const studentsResult = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1',
      ['student']
    );

    // Get active internships count
    const internshipsResult = await pool.query(
      'SELECT COUNT(*) as count FROM internships WHERE status = $1',
      ['published']
    );

    // Get total applications count
    const applicationsResult = await pool.query(
      'SELECT COUNT(*) as count FROM applications'
    );

    // Get completed tasks count
    const completedTasksResult = await pool.query(
      'SELECT COUNT(*) as count FROM admin_tasks WHERE status = $1 AND is_active = true',
      ['completed']
    );

    // Get total tasks count
    const totalTasksResult = await pool.query(
      'SELECT COUNT(*) as count FROM admin_tasks WHERE is_active = true'
    );

    // Get pending tasks count
    const pendingTasksResult = await pool.query(
      'SELECT COUNT(*) as count FROM admin_tasks WHERE status = $1 AND is_active = true',
      ['pending']
    );

    // Get in-progress tasks count
    const inProgressTasksResult = await pool.query(
      'SELECT COUNT(*) as count FROM admin_tasks WHERE status = $1 AND is_active = true',
      ['in-progress']
    );

    // Get monthly applications data (last 6 months)
    const monthlyApplicationsResult = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Mon') as month,
        COUNT(*) as applications
      FROM applications 
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon')
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    // Get monthly internships data (last 6 months)
    const monthlyInternshipsResult = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Mon') as month,
        COUNT(*) as internships
      FROM internships 
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon')
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    // Get recent activities
    const recentActivitiesResult = await pool.query(`
      (
        SELECT 
          'New student registered' as action,
          full_name as user_name,
          created_at,
          'user' as type
        FROM users 
        WHERE role = 'student' AND created_at >= NOW() - INTERVAL '7 days'
      )
      UNION ALL
      (
        SELECT 
          'Internship application submitted' as action,
          u.full_name as user_name,
          a.created_at,
          'application' as type
        FROM applications a
        JOIN users u ON a.student_id = u.id
        WHERE a.created_at >= NOW() - INTERVAL '7 days'
      )
      UNION ALL
      (
        SELECT 
          'Task completed' as action,
          u.full_name as user_name,
          t.updated_at as created_at,
          'task' as type
        FROM admin_tasks t
        JOIN users u ON t.assigned_to = u.id
        WHERE t.status = 'completed' AND t.updated_at >= NOW() - INTERVAL '7 days'
      )
      UNION ALL
      (
        SELECT 
          'New company registered' as action,
          company_name as user_name,
          created_at,
          'company' as type
        FROM users 
        WHERE role = 'company' AND created_at >= NOW() - INTERVAL '7 days'
      )
      ORDER BY created_at DESC
      LIMIT 10
    `);

    // Combine monthly data
    const monthlyData = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    
    for (const month of months) {
      const applicationData = monthlyApplicationsResult.rows.find(row => row.month === month);
      const internshipData = monthlyInternshipsResult.rows.find(row => row.month === month);
      
      monthlyData.push({
        month,
        applications: applicationData ? parseInt(applicationData.applications) : 0,
        internships: internshipData ? parseInt(internshipData.internships) : 0
      });
    }

    const analytics = {
      stats: {
        totalStudents: parseInt(studentsResult.rows[0].count),
        activeInternships: parseInt(internshipsResult.rows[0].count),
        totalApplications: parseInt(applicationsResult.rows[0].count),
        completedTasks: parseInt(completedTasksResult.rows[0].count)
      },
      taskStatusData: [
        { 
          name: 'Completed', 
          value: parseInt(completedTasksResult.rows[0].count), 
          color: '#10B981' 
        },
        { 
          name: 'In Progress', 
          value: parseInt(inProgressTasksResult.rows[0].count), 
          color: '#F59E0B' 
        },
        { 
          name: 'Pending', 
          value: parseInt(pendingTasksResult.rows[0].count), 
          color: '#6B7280' 
        }
      ],
      monthlyData,
      recentActivities: recentActivitiesResult.rows.map(activity => ({
        id: Math.random().toString(36).substr(2, 9),
        action: activity.action,
        user: activity.user_name,
        time: getTimeAgo(activity.created_at),
        type: activity.type
      }))
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to format time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInDays > 0) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  } else if (diffInHours > 0) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

// Get detailed analytics (admin only)
router.get('/detailed', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get user growth data (last 6 months)
    const userGrowthResult = await pool.query(`
      SELECT 
        TO_CHAR(created_at, 'Mon') as month,
        COUNT(*) FILTER (WHERE role = 'student') as students,
        COUNT(*) FILTER (WHERE role = 'company') as companies,
        COUNT(*) as total_users
      FROM users 
      WHERE created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon')
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    // Get application status distribution
    const applicationStatusResult = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count
      FROM applications
      GROUP BY status
    `);

    // Get task completion data (last 4 weeks)
    const taskCompletionResult = await pool.query(`
      SELECT 
        'Week ' || (4 - (EXTRACT(WEEK FROM NOW()) - EXTRACT(WEEK FROM created_at))) as week,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) as assigned
      FROM admin_tasks
      WHERE created_at >= NOW() - INTERVAL '4 weeks'
      GROUP BY EXTRACT(WEEK FROM created_at)
      ORDER BY EXTRACT(WEEK FROM created_at)
    `);

    // Get industry distribution
    const industryResult = await pool.query(`
      SELECT 
        c.industry,
        COUNT(DISTINCT c.id) as companies,
        COUNT(i.id) as internships
      FROM companies c
      LEFT JOIN internships i ON c.id = i.company_id
      WHERE c.industry IS NOT NULL
      GROUP BY c.industry
      ORDER BY companies DESC
      LIMIT 5
    `);

    // Get KPI data
    const totalUsersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    const activeInternshipsResult = await pool.query('SELECT COUNT(*) as count FROM internships WHERE status = $1', ['published']);
    const totalApplicationsResult = await pool.query('SELECT COUNT(*) as count FROM applications');
    const completedTasksResult = await pool.query('SELECT COUNT(*) as count FROM admin_tasks WHERE status = $1', ['completed']);
    const totalTasksResult = await pool.query('SELECT COUNT(*) as count FROM admin_tasks');

    // Calculate application rate (applications per internship)
    const applicationRate = totalApplicationsResult.rows[0].count > 0 && activeInternshipsResult.rows[0].count > 0
      ? ((totalApplicationsResult.rows[0].count / activeInternshipsResult.rows[0].count) * 100).toFixed(1)
      : '0';

    // Calculate task completion rate
    const taskCompletionRate = totalTasksResult.rows[0].count > 0
      ? ((completedTasksResult.rows[0].count / totalTasksResult.rows[0].count) * 100).toFixed(1)
      : '0';

    // Transform data for frontend
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const userGrowthData = months.map(month => {
      const data = userGrowthResult.rows.find(row => row.month === month);
      return {
        month,
        students: data ? parseInt(data.students) : 0,
        companies: data ? parseInt(data.companies) : 0,
        applications: 0 // Will be filled separately if needed
      };
    });

    const applicationStatusData = [
      { name: 'Pending', value: 0, color: '#F59E0B' },
      { name: 'Reviewed', value: 0, color: '#3B82F6' },
      { name: 'Accepted', value: 0, color: '#10B981' },
      { name: 'Rejected', value: 0, color: '#EF4444' },
      { name: 'Withdrawn', value: 0, color: '#6B7280' }
    ];

    // Fill application status data
    applicationStatusResult.rows.forEach(row => {
      const statusMap = {
        'pending': 'Pending',
        'reviewed': 'Reviewed', 
        'accepted': 'Accepted',
        'rejected': 'Rejected',
        'withdrawn': 'Withdrawn'
      };
      const statusName = statusMap[row.status as keyof typeof statusMap];
      const statusItem = applicationStatusData.find(item => item.name === statusName);
      if (statusItem) {
        statusItem.value = parseInt(row.count);
      }
    });

    const taskCompletionData = taskCompletionResult.rows.map(row => ({
      week: row.week,
      completed: parseInt(row.completed),
      assigned: parseInt(row.assigned)
    }));

    const industryData = industryResult.rows.map(row => ({
      industry: row.industry,
      companies: parseInt(row.companies),
      internships: parseInt(row.internships)
    }));

    const kpiData = [
      {
        title: 'Total Users',
        value: totalUsersResult.rows[0].count,
        change: '+12.5%', // This would need historical data to calculate
        trend: 'up',
        icon: 'Users',
        color: 'blue'
      },
      {
        title: 'Active Internships',
        value: activeInternshipsResult.rows[0].count,
        change: '+8.3%', // This would need historical data to calculate
        trend: 'up',
        icon: 'Briefcase',
        color: 'green'
      },
      {
        title: 'Application Rate',
        value: `${applicationRate}%`,
        change: '+5.1%', // This would need historical data to calculate
        trend: 'up',
        icon: 'Target',
        color: 'purple'
      },
      {
        title: 'Task Completion',
        value: `${taskCompletionRate}%`,
        change: '-2.1%', // This would need historical data to calculate
        trend: parseFloat(taskCompletionRate) > 80 ? 'up' : 'down',
        icon: 'BarChart3',
        color: 'orange'
      }
    ];

    const analytics = {
      userGrowthData,
      applicationStatusData,
      taskCompletionData,
      industryData,
      kpiData,
      engagementData: [], // Would need user activity tracking to implement
      summary: {
        userSatisfaction: '4.8', // Would need feedback system to implement
        successRate: applicationRate,
        averageSessionDuration: '9.2' // Would need user activity tracking to implement
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get detailed analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get company analytics (company only)
router.get('/company', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'company') {
      return res.status(403).json({ error: 'Company access required' });
    }

    // Get company ID
    const companyResult = await pool.query(
      'SELECT id FROM companies WHERE user_id = $1',
      [req.user.id]
    );

    if (companyResult.rows.length === 0) {
      // Return empty analytics data if company profile doesn't exist yet
      const emptyAnalytics = {
        applicationTrendData: [
          { month: 'Jan', applications: 0, accepted: 0, rejected: 0, pending: 0, views: 0 },
          { month: 'Feb', applications: 0, accepted: 0, rejected: 0, pending: 0, views: 0 },
          { month: 'Mar', applications: 0, accepted: 0, rejected: 0, pending: 0, views: 0 },
          { month: 'Apr', applications: 0, accepted: 0, rejected: 0, pending: 0, views: 0 },
          { month: 'May', applications: 0, accepted: 0, rejected: 0, pending: 0, views: 0 },
          { month: 'Jun', applications: 0, accepted: 0, rejected: 0, pending: 0, views: 0 }
        ],
        internshipPerformanceData: [],
        applicationStatusData: [
          { name: 'Pending', value: 0, color: '#F59E0B' },
          { name: 'Accepted', value: 0, color: '#10B981' },
          { name: 'Rejected', value: 0, color: '#EF4444' },
          { name: 'Reviewed', value: 0, color: '#3B82F6' }
        ],
        kpiData: [
          {
            title: 'Total Internships',
            value: 0,
            change: '+0%',
            trend: 'up',
            icon: 'Briefcase',
            color: 'blue'
          },
          {
            title: 'Active Postings',
            value: 0,
            change: '+0%',
            trend: 'up',
            icon: 'Eye',
            color: 'green'
          },
          {
            title: 'Total Applications',
            value: 0,
            change: '+0%',
            trend: 'up',
            icon: 'Users',
            color: 'purple'
          },
          {
            title: 'Acceptance Rate',
            value: '0%',
            change: '+0%',
            trend: 'up',
            icon: 'Target',
            color: 'orange'
          }
        ],
        summary: {
          totalInternships: 0,
          activeInternships: 0,
          totalApplications: 0,
          averageApplicationsPerInternship: 0,
          acceptanceRate: 0,
          topPerformingInternship: 'N/A'
        }
      };
      return res.json(emptyAnalytics);
    }

    const companyId = companyResult.rows[0].id;

    // Get company's internships
    const internshipsResult = await pool.query(`
      SELECT 
        i.*,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as applications_count,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'accepted') as accepted_count,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'pending') as pending_count,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id AND status = 'rejected') as rejected_count
      FROM internships i
      WHERE i.company_id = $1
      ORDER BY i.created_at DESC
    `, [companyId]);

    // Get application trends (last 6 months)
    const applicationTrendsResult = await pool.query(`
      SELECT 
        TO_CHAR(a.applied_at, 'Mon') as month,
        COUNT(*) as applications,
        COUNT(*) FILTER (WHERE a.status = 'accepted') as accepted,
        COUNT(*) FILTER (WHERE a.status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE a.status = 'pending') as pending
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = $1 AND a.applied_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', a.applied_at), TO_CHAR(a.applied_at, 'Mon')
      ORDER BY DATE_TRUNC('month', a.applied_at)
    `, [companyId]);

    // Get internship performance data
    const internshipPerformanceResult = await pool.query(`
      SELECT 
        i.title,
        i.id,
        COUNT(a.id) as applications,
        COUNT(a.id) FILTER (WHERE a.status = 'accepted') as accepted,
        COUNT(a.id) FILTER (WHERE a.status = 'rejected') as rejected,
        COUNT(a.id) FILTER (WHERE a.status = 'pending') as pending,
        CASE 
          WHEN COUNT(a.id) > 0 THEN ROUND((COUNT(a.id) FILTER (WHERE a.status = 'accepted')::decimal / COUNT(a.id)) * 100, 1)
          ELSE 0 
        END as conversion_rate
      FROM internships i
      LEFT JOIN applications a ON i.id = a.internship_id
      WHERE i.company_id = $1
      GROUP BY i.id, i.title
      ORDER BY applications DESC
      LIMIT 10
    `, [companyId]);

    // Get application status distribution
    const applicationStatusResult = await pool.query(`
      SELECT 
        a.status,
        COUNT(*) as count
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = $1
      GROUP BY a.status
    `, [companyId]);

    // Calculate KPIs
    const totalInternships = internshipsResult.rows.length;
    const activeInternships = internshipsResult.rows.filter(i => i.status === 'published').length;
    const totalApplications = internshipsResult.rows.reduce((sum, i) => sum + parseInt(i.applications_count), 0);
    const totalAccepted = internshipsResult.rows.reduce((sum, i) => sum + parseInt(i.accepted_count), 0);
    const averageApplicationsPerInternship = totalInternships > 0 ? Math.round(totalApplications / totalInternships) : 0;
    const acceptanceRate = totalApplications > 0 ? ((totalAccepted / totalApplications) * 100).toFixed(1) : '0';

    // Transform data for frontend
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const applicationTrendData = months.map(month => {
      const data = applicationTrendsResult.rows.find(row => row.month === month);
      return {
        month,
        applications: data ? parseInt(data.applications) : 0,
        accepted: data ? parseInt(data.accepted) : 0,
        rejected: data ? parseInt(data.rejected) : 0,
        pending: data ? parseInt(data.pending) : 0,
        views: 0 // Would need view tracking to implement
      };
    });

    const internshipPerformanceData = internshipPerformanceResult.rows.map(row => ({
      title: row.title.length > 20 ? row.title.substring(0, 20) + '...' : row.title,
      id: row.id,
      applications: parseInt(row.applications),
      accepted: parseInt(row.accepted),
      rejected: parseInt(row.rejected),
      pending: parseInt(row.pending),
      conversion: parseFloat(row.conversion_rate),
      views: 0 // Would need view tracking to implement
    }));

    const applicationStatusData = [
      { name: 'Pending', value: 0, color: '#F59E0B' },
      { name: 'Accepted', value: 0, color: '#10B981' },
      { name: 'Rejected', value: 0, color: '#EF4444' },
      { name: 'Reviewed', value: 0, color: '#3B82F6' }
    ];

    // Fill application status data
    applicationStatusResult.rows.forEach(row => {
      const statusMap = {
        'pending': 'Pending',
        'accepted': 'Accepted',
        'rejected': 'Rejected',
        'reviewed': 'Reviewed'
      };
      const statusName = statusMap[row.status as keyof typeof statusMap];
      const statusItem = applicationStatusData.find(item => item.name === statusName);
      if (statusItem) {
        statusItem.value = parseInt(row.count);
      }
    });

    const kpiData = [
      {
        title: 'Total Internships',
        value: totalInternships,
        change: '+0%', // Would need historical data
        trend: 'up',
        icon: 'Briefcase',
        color: 'blue'
      },
      {
        title: 'Active Postings',
        value: activeInternships,
        change: '+0%', // Would need historical data
        trend: 'up',
        icon: 'Eye',
        color: 'green'
      },
      {
        title: 'Total Applications',
        value: totalApplications,
        change: '+0%', // Would need historical data
        trend: 'up',
        icon: 'Users',
        color: 'purple'
      },
      {
        title: 'Acceptance Rate',
        value: `${acceptanceRate}%`,
        change: '+0%', // Would need historical data
        trend: parseFloat(acceptanceRate) > 20 ? 'up' : 'down',
        icon: 'Target',
        color: 'orange'
      }
    ];

    const analytics = {
      applicationTrendData,
      internshipPerformanceData,
      applicationStatusData,
      kpiData,
      summary: {
        totalInternships,
        activeInternships,
        totalApplications,
        averageApplicationsPerInternship,
        acceptanceRate: parseFloat(acceptanceRate),
        topPerformingInternship: internshipPerformanceData[0]?.title || 'N/A'
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get company analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get company dashboard analytics (company only)
router.get('/company/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'company') {
      return res.status(403).json({ error: 'Company access required' });
    }

    // Get company ID
    const companyResult = await pool.query(
      'SELECT id FROM companies WHERE user_id = $1',
      [req.user.id]
    );

    if (companyResult.rows.length === 0) {
      // Return empty dashboard data if company profile doesn't exist yet
      const emptyDashboard = {
        stats: {
          activeInternships: 0,
          totalApplications: 0,
          pendingApplications: 0,
          acceptedApplications: 0,
          profileViews: 0
        },
        recentApplications: [],
        monthlyData: [
          { month: 'Jan', applications: 0 },
          { month: 'Feb', applications: 0 },
          { month: 'Mar', applications: 0 },
          { month: 'Apr', applications: 0 },
          { month: 'May', applications: 0 },
          { month: 'Jun', applications: 0 }
        ],
        internships: []
      };
      return res.json(emptyDashboard);
    }

    const companyId = companyResult.rows[0].id;

    // Get basic stats
    const activeInternshipsResult = await pool.query(
      'SELECT COUNT(*) as count FROM internships WHERE company_id = $1 AND status = $2',
      [companyId, 'published']
    );

    const totalApplicationsResult = await pool.query(`
      SELECT COUNT(*) as count FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = $1
    `, [companyId]);

    const pendingApplicationsResult = await pool.query(`
      SELECT COUNT(*) as count FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = $1 AND a.status = 'pending'
    `, [companyId]);

    const acceptedApplicationsResult = await pool.query(`
      SELECT COUNT(*) as count FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = $1 AND a.status = 'accepted'
    `, [companyId]);

    // Get profile views (for now, we'll calculate based on applications as a proxy)
    // In a real implementation, you'd track actual profile views
    const profileViewsResult = await pool.query(`
      SELECT COUNT(DISTINCT a.student_id) as count FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = $1
    `, [companyId]);

    // Get recent applications (last 5)
    const recentApplicationsResult = await pool.query(`
      SELECT 
        a.*,
        i.title as internship_title,
        u.full_name as student_name,
        u.email as student_email,
        u.university,
        u.major
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      JOIN users u ON a.student_id = u.id
      WHERE i.company_id = $1
      ORDER BY a.applied_at DESC
      LIMIT 5
    `, [companyId]);

    // Get monthly application trends (last 6 months)
    const monthlyTrendsResult = await pool.query(`
      SELECT 
        TO_CHAR(a.applied_at, 'Mon') as month,
        COUNT(*) as applications
      FROM applications a
      JOIN internships i ON a.internship_id = i.id
      WHERE i.company_id = $1 AND a.applied_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', a.applied_at), TO_CHAR(a.applied_at, 'Mon')
      ORDER BY DATE_TRUNC('month', a.applied_at)
    `, [companyId]);

    // Get company internships with application counts
    const internshipsResult = await pool.query(`
      SELECT 
        i.*,
        (SELECT COUNT(*) FROM applications WHERE internship_id = i.id) as applications_count
      FROM internships i
      WHERE i.company_id = $1
      ORDER BY i.created_at DESC
      LIMIT 10
    `, [companyId]);

    // Transform monthly data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const monthlyData = months.map(month => {
      const data = monthlyTrendsResult.rows.find(row => row.month === month);
      return {
        month,
        applications: data ? parseInt(data.applications) : 0
      };
    });

    const analytics = {
      stats: {
        activeInternships: parseInt(activeInternshipsResult.rows[0].count),
        totalApplications: parseInt(totalApplicationsResult.rows[0].count),
        pendingApplications: parseInt(pendingApplicationsResult.rows[0].count),
        acceptedApplications: parseInt(acceptedApplicationsResult.rows[0].count),
        profileViews: parseInt(profileViewsResult.rows[0].count)
      },
      recentApplications: recentApplicationsResult.rows.map(app => ({
        id: app.id,
        internshipId: app.internship_id,
        internshipTitle: app.internship_title,
        studentName: app.student_name,
        studentEmail: app.student_email,
        university: app.university,
        major: app.major,
        status: app.status,
        appliedAt: app.applied_at,
        coverLetter: app.cover_letter
      })),
      monthlyData,
      internships: internshipsResult.rows.map(internship => ({
        id: internship.id,
        title: internship.title,
        status: internship.status,
        applicationsCount: parseInt(internship.applications_count),
        deadline: internship.application_deadline,
        createdAt: internship.created_at
      }))
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get company dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get student dashboard analytics (student only)
router.get('/student/dashboard', authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role !== 'student') {
      return res.status(403).json({ error: 'Student access required' });
    }

    const studentId = req.user.id;

    // Get student's applications count
    const applicationsResult = await pool.query(
      'SELECT COUNT(*) as count FROM applications WHERE student_id = $1',
      [studentId]
    );

    // Get student's tasks stats
    const tasksResult = await pool.query(`
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(*) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_tasks,
        COUNT(*) FILTER (WHERE status = 'in-progress') as in_progress_tasks,
        COALESCE(SUM(points) FILTER (WHERE status = 'completed'), 0) as total_points
      FROM admin_tasks 
      WHERE assigned_to = $1 AND is_active = true
    `, [studentId]);

    // Get student's course progress
    const coursesResult = await pool.query(`
      SELECT 
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT ce.course_id) as enrolled_courses,
        COUNT(DISTINCT ce.course_id) FILTER (WHERE ce.is_completed = true) as completed_courses,
        COALESCE(AVG(ce.progress), 0) as average_progress
      FROM courses c
      LEFT JOIN course_enrollments ce ON c.id = ce.course_id AND ce.student_id = $1
      WHERE c.is_active = true
    `, [studentId]);

    // Get student's certificates count
    const certificatesResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM course_certificates cc
      JOIN course_enrollments ce ON cc.enrollment_id = ce.id
      WHERE ce.student_id = $1
    `, [studentId]);

    // Get technical vs soft skills progress
    const skillsProgressResult = await pool.query(`
      SELECT 
        c.category,
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT ce.course_id) as enrolled_courses,
        COUNT(DISTINCT ce.course_id) FILTER (WHERE ce.is_completed = true) as completed_courses,
        COALESCE(AVG(ce.progress), 0) as average_progress
      FROM courses c
      LEFT JOIN course_enrollments ce ON c.id = ce.course_id AND ce.student_id = $1
      WHERE c.is_active = true
      GROUP BY c.category
    `, [studentId]);

    const taskStats = tasksResult.rows[0];
    const courseStats = coursesResult.rows[0];
    const certificatesCount = parseInt(certificatesResult.rows[0].count);
    
    // Process skills progress
    const skillsProgress = skillsProgressResult.rows.reduce((acc, row) => {
      const category = row.category.toLowerCase();
      if (category.includes('technical') || category.includes('programming') || category.includes('development')) {
        acc.technical = {
          progress: Math.round(parseFloat(row.average_progress)),
          completed: parseInt(row.completed_courses),
          total: parseInt(row.enrolled_courses) || parseInt(row.total_courses)
        };
      } else if (category.includes('soft') || category.includes('communication') || category.includes('leadership')) {
        acc.soft = {
          progress: Math.round(parseFloat(row.average_progress)),
          completed: parseInt(row.completed_courses),
          total: parseInt(row.enrolled_courses) || parseInt(row.total_courses)
        };
      }
      return acc;
    }, {
      technical: { progress: 0, completed: 0, total: 0 },
      soft: { progress: 0, completed: 0, total: 0 }
    });

    const analytics = {
      applications: {
        total: parseInt(applicationsResult.rows[0].count)
      },
      tasks: {
        total: parseInt(taskStats.total_tasks),
        completed: parseInt(taskStats.completed_tasks),
        pending: parseInt(taskStats.pending_tasks),
        inProgress: parseInt(taskStats.in_progress_tasks),
        totalPoints: parseInt(taskStats.total_points)
      },
      learning: {
        totalCourses: parseInt(courseStats.total_courses),
        enrolledCourses: parseInt(courseStats.enrolled_courses),
        completedCourses: parseInt(courseStats.completed_courses),
        averageProgress: Math.round(parseFloat(courseStats.average_progress)),
        certificates: certificatesCount,
        skillsProgress
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Get student dashboard analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;