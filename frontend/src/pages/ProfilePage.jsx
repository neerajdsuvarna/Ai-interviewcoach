import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabaseClient';
import { 
  FiUser, 
  FiMail, 
  FiCalendar, 
  FiEdit3, 
  FiSave, 
  FiX, 
  FiCreditCard, 
  FiSettings, 
  FiBarChart, 
  FiShield, 
  FiBell,
  FiChevronRight,
  FiMenu,
  FiX as FiClose
} from 'react-icons/fi';
import Navbar from '../components/Navbar';

// Component for Profile Section
const ProfileSection = ({ user, profileData, setProfileData, isEditing, setIsEditing, loading, setLoading, handleSave, handleCancel, formatDate }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Personal Information
        </h2>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-input-bg)] rounded-lg transition"
          >
            <FiEdit3 size={16} />
            <span>Edit Profile</span>
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg transition disabled:opacity-50"
            >
              <FiSave size={16} />
              <span>{loading ? 'Saving...' : 'Save'}</span>
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-input-bg)] rounded-lg transition"
            >
              <FiX size={16} />
              <span>Cancel</span>
            </button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center space-x-4">
          <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
            {profileData.avatar_url ? (
              <img 
                src={profileData.avatar_url} 
                alt="Profile" 
                className="w-20 h-20 rounded-full object-cover"
              />
            ) : (
              <FiUser size={32} className="text-white" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)]">
              Profile Picture
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {profileData.avatar_url ? 'Custom avatar' : 'Default avatar'}
            </p>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              <FiUser className="inline mr-2" size={16} />
              Full Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={profileData.full_name}
                onChange={(e) => setProfileData({...profileData, full_name: e.target.value})}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Enter your full name"
              />
            ) : (
              <p className="text-[var(--color-text-primary)]">
                {profileData.full_name || 'Not provided'}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              <FiMail className="inline mr-2" size={16} />
              Email Address
            </label>
            <p className="text-[var(--color-text-primary)]">
              {profileData.email}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              Avatar URL
            </label>
            {isEditing ? (
              <input
                type="url"
                value={profileData.avatar_url}
                onChange={(e) => setProfileData({...profileData, avatar_url: e.target.value})}
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-input-bg)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                placeholder="Enter avatar URL"
              />
            ) : (
              <p className="text-[var(--color-text-primary)]">
                {profileData.avatar_url || 'No custom avatar'}
              </p>
            )}
          </div>

          {/* Account Created */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-2">
              <FiCalendar className="inline mr-2" size={16} />
              Account Created
            </label>
            <p className="text-[var(--color-text-primary)]">
              {formatDate(profileData.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Component for Payments Section
const PaymentsSection = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Payment Information
        </h2>
        <button className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-input-bg)] rounded-lg transition">
          <FiCreditCard size={16} />
          <span>Add Payment Method</span>
        </button>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="text-center py-8">
          <FiCreditCard size={48} className="mx-auto text-[var(--color-text-secondary)] mb-4" />
          <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
            No Payment Methods
          </h3>
          <p className="text-[var(--color-text-secondary)] mb-4">
            Add a payment method to access premium features
          </p>
          <button className="px-6 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition">
            Add Payment Method
          </button>
        </div>
      </div>
    </div>
  );
};

// Component for Analytics Section
const AnalyticsSection = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
        Analytics & Performance
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary)] mb-2">0</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Interviews Completed</div>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary)] mb-2">0</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Resumes Uploaded</div>
        </div>
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary)] mb-2">0</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Practice Sessions</div>
        </div>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
        <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-4">
          Recent Activity
        </h3>
        <div className="text-center py-8 text-[var(--color-text-secondary)]">
          <FiBarChart size={48} className="mx-auto mb-4" />
          <p>No recent activity to display</p>
        </div>
      </div>
    </div>
  );
};

// Component for Settings Section
const SettingsSection = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
        Account Settings
      </h2>

      <div className="space-y-4">
        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiBell size={20} className="text-[var(--color-primary)]" />
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">Notifications</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Manage your notification preferences</p>
              </div>
            </div>
            <button className="text-[var(--color-primary)] hover:underline">Configure</button>
          </div>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiShield size={20} className="text-[var(--color-primary)]" />
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">Privacy & Security</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Manage your privacy settings</p>
              </div>
            </div>
            <button className="text-[var(--color-primary)] hover:underline">Configure</button>
          </div>
        </div>

        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FiSettings size={20} className="text-[var(--color-primary)]" />
              <div>
                <h3 className="font-medium text-[var(--color-text-primary)]">Preferences</h3>
                <p className="text-sm text-[var(--color-text-secondary)]">Customize your experience</p>
              </div>
            </div>
            <button className="text-[var(--color-primary)] hover:underline">Configure</button>
          </div>
        </div>
      </div>
    </div>
  );
};

function ProfilePage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('profile');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    full_name: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    avatar_url: user?.user_metadata?.avatar_url || '',
    created_at: user?.created_at || ''
  });

  const navigationItems = [
    { id: 'profile', label: 'Profile', icon: FiUser, description: 'Personal information' },
    { id: 'payments', label: 'Payments', icon: FiCreditCard, description: 'Billing & subscriptions' },
    { id: 'analytics', label: 'Analytics', icon: FiBarChart, description: 'Performance metrics' },
    { id: 'settings', label: 'Settings', icon: FiSettings, description: 'Account preferences' },
  ];

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url
        }
      });

      if (error) {
        console.error('Error updating profile:', error);
        alert('Failed to update profile');
      } else {
        setIsEditing(false);
        alert('Profile updated successfully!');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setProfileData({
      full_name: user?.user_metadata?.full_name || '',
      email: user?.email || '',
      avatar_url: user?.user_metadata?.avatar_url || '',
      created_at: user?.created_at || ''
    });
    setIsEditing(false);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <ProfileSection 
            user={user}
            profileData={profileData}
            setProfileData={setProfileData}
            isEditing={isEditing}
            setIsEditing={setIsEditing}
            loading={loading}
            setLoading={setLoading}
            handleSave={handleSave}
            handleCancel={handleCancel}
            formatDate={formatDate}
          />
        );
      case 'payments':
        return <PaymentsSection />;
      case 'analytics':
        return <AnalyticsSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <ProfileSection />;
    }
  };

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-[var(--color-bg)]">
        {/* Mobile Header */}
        <div className="md:hidden bg-[var(--color-card)] border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-[var(--color-input-bg)]"
            >
              {sidebarOpen ? <FiClose size={20} /> : <FiMenu size={20} />}
            </button>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {navigationItems.find(item => item.id === activeSection)?.label}
            </h1>
            <div className="w-8"></div> {/* Spacer for centering */}
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className={`
            fixed md:static inset-y-0 left-0 z-40 w-64 bg-[var(--color-card)] border-r border-[var(--color-border)] transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            <div className="p-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-6">
                Account Settings
              </h2>
              
              <nav className="space-y-2">
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`
                        w-full flex items-center justify-between p-3 rounded-lg transition-all duration-200
                        ${activeSection === item.id 
                          ? 'bg-[var(--color-primary)] text-white shadow-sm' 
                          : 'text-[var(--color-text-primary)] hover:bg-[var(--color-input-bg)]'
                        }
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon size={18} />
                        <div className="text-left">
                          <div className="font-medium">{item.label}</div>
                          <div className="text-xs opacity-75">{item.description}</div>
                        </div>
                      </div>
                      <FiChevronRight size={16} className="opacity-50" />
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="max-w-4xl mx-auto px-6 py-8">
              {/* Desktop Header */}
              <div className="hidden md:block mb-8">
                <div className="flex items-center space-x-2 text-sm text-[var(--color-text-secondary)] mb-2">
                  <span>Account</span>
                  <FiChevronRight size={14} />
                  <span>{navigationItems.find(item => item.id === activeSection)?.label}</span>
                </div>
                <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                  {navigationItems.find(item => item.id === activeSection)?.label}
                </h1>
                <p className="text-[var(--color-text-secondary)] mt-1">
                  {navigationItems.find(item => item.id === activeSection)?.description}
                </p>
              </div>

              {/* Content */}
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6 shadow-sm">
                {renderActiveSection()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfilePage;