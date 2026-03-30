// ===========================================
// 8. Overview.jsx (Dashboard)
// ===========================================
import React, { useContext } from 'react';
import { BarChart3, Users, Folder, Award, MessageSquare, TrendingUp } from 'lucide-react';
import { AdminContext } from '../pages/Admin';
import { useNavigate } from 'react-router-dom';

const Overview = () => {
  const { stats, user } = useContext(AdminContext);
  const navigate = useNavigate();

  const dashboardCards = [
    {
      title: 'Total Projects',
      value: stats.projects || 0,
      icon: Folder,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      textColor: 'text-blue-600 dark:text-blue-400',
      path: '/admin/projects',
    },
    {
      title: 'Messages',
      value: stats.messages || 0,
      icon: MessageSquare,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      textColor: 'text-green-600 dark:text-green-400',
      path: '/admin/contacts',
    },
    {
      title: 'Skills',
      value: stats.skills || 0,
      icon: Award,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      textColor: 'text-purple-600 dark:text-purple-400',
      path: '/admin/skills',
    },
    {
      title: 'Experiences',
      value: stats.experiences || 0,
      icon: TrendingUp,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      textColor: 'text-orange-600 dark:text-orange-400',
      path: '/admin/experiences',
    },
  ];

  const quickActions = [
    { label: 'View Profile', path: '/admin/profile', icon: Users },
    { label: 'Manage Sessions', path: '/admin/sessions', icon: Users },
    { label: 'Activity Logs', path: '/admin/activity-logs', icon: BarChart3 },
    { label: 'Settings', path: '/admin/settings', icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl shadow-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user?.firstName || user?.username}!</h1>
        <p className="text-indigo-100">Here's an overview of your portfolio dashboard</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div
              key={index}
              onClick={() => navigate(card.path)}
              className={`${card.bgColor} rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${card.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`text-3xl font-bold ${card.textColor}`}>
                  {card.value}
                </span>
              </div>
              <h3 className="text-gray-700 dark:text-gray-300 font-semibold">
                {card.title}
              </h3>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <button
                key={index}
                onClick={() => navigate(action.path)}
                className="flex items-center justify-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors border border-gray-200 dark:border-gray-600"
              >
                <Icon size={20} className="text-indigo-500" />
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          System Information
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Role</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
              {user?.role || 'Admin'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Last Login</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview;

