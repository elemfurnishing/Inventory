import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, X, User as UserIcon, Key, Shield, Save, Loader2, Layout, Eye, EyeOff } from "lucide-react";
import { User } from "../types";

const API_URL = import.meta.env.VITE_SHEET_API_URL || "https://script.google.com/macros/s/AKfycbyr8QBIGE3jlMqm3w4r3f-jvRKTJdUKP0Tc4jDITpadSJqQbL8JOC_E6TLXr0xxBJKknA/exec";
const LOGIN_SHEET = import.meta.env.VITE_SHEET_LOGIN_NAME || "Login Master";

const Settings = () => {
  const [showModal, setShowModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [pageOptions, setPageOptions] = useState<string[]>([]); // Store available pages
  const [showPassword, setShowPassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set());

  const [formData, setFormData] = useState({
    serialNo: "",
    userName: "",
    userId: "",
    password: "",
    role: "User",
    pageAccess: [] as string[], // Store selected pages
  });

  // Fetch page options from Drop Down Master
  const fetchPageOptions = async () => {
    try {
      // Try to fetch from the sheet
        // Since VITE_SHEET_DROP_NAME is set, used it logic. But user didn't specify strict drop down logic in Prompt 2, 
        // they just said "match in side bar". Sidebar items are Dashboard, Inventory, History, Settings.
        // I will stick to these defaults to ensure it matches the Sidebar logic requested.
      const defaultOptions = ["Dashboard", "Inventory", "History", "Settings"];
      setPageOptions(defaultOptions);
    } catch (error) {
      console.error("Error fetching page options:", error);
      setPageOptions(["Dashboard", "Inventory", "History", "Settings"]);
    }
  };

  // Fetch users from Google Sheets
  const fetchUsers = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}?sheet=${LOGIN_SHEET}&action=getData&ts=${Date.now()}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch users data');
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         const text = await response.text();
         console.error('Received non-JSON response in settings:', text.substring(0, 100));
         throw new Error("Received non-JSON response from server");
      }

      const data = await response.json();
      if (data.success && data.data) {
        const sheetData = data.data;
        const usersData: User[] = [];

        // Start from row 2 (index 1) as per specification
        for (let i = 1; i < sheetData.length; i++) {
          const row = sheetData[i];

          // Check if row has at least basic data (Serial No in column A)
          if (row[0]) { // Column A has data (Serial No)
            const user: User = {
              username: row[2] || '', // Mapped from userId
              displayName: row[1] || '', // Mapped from userName
              
              id: i + 1, // Use row number as ID for editing
              serialNo: row[0] || '', // Column A - Serial No
              userName: row[1] || '', // Column B - User Name (Legacy/Sheet)
              userId: row[2] || '', // Column C - ID (Legacy/Sheet)
              password: row[3] || '', // Column D - Pass
              role: row[4] || 'User', // Column E - Role
              pageAccess: row[5] ? String(row[5]).replace(/"/g, '').split(',').map(s => s.trim()).filter(Boolean) : [], // Column F - Page Access
              rowIndex: i + 1 // Store actual row index for updates
            };
            usersData.push(user);
          }
        }

        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generate new Serial Number (SN-001, SN-002, etc.)
  const generateSerialNo = () => {
    if (users.length === 0) return 'SN-001';

    // Find the highest serial number
    const lastUser = users[users.length - 1];
    const match = (lastUser.serialNo || '').match(/SN-(\d+)/);

    if (match) {
      const nextNum = parseInt(match[1]) + 1;
      return `SN-${String(nextNum).padStart(3, '0')}`;
    }

    // If no match found, generate based on count
    return `SN-${String(users.length + 1).padStart(3, '0')}`;
  };

  // Load users on component mount
  useEffect(() => {
    fetchUsers();
    fetchPageOptions();
  }, []);

  const handleAddNewUser = () => {
    setFormData({
      serialNo: generateSerialNo(),
      userName: "",
      userId: "",
      password: "",
      role: "User",
      pageAccess: ["Dashboard", "Inventory", "History", "Settings"],
    });
    setEditingUser(null);
    setShowPassword(false);
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    // Normalize role to Title Case (User or Admin) to match select options
    const normalizedRole = user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase();
    
    setFormData({
      serialNo: user.serialNo || '',
      userName: user.userName || '',
      userId: user.userId || '',
      password: user.password || '',
      role: ["User", "Admin"].includes(normalizedRole) ? normalizedRole : "User",
      pageAccess: user.pageAccess || [],
    });
    setEditingUser(user);
    setShowPassword(false);
    setShowModal(true);
  };

  const handleDelete = async (user: User) => {
    // Prevent deleting the first user (Master Admin)
    if (user.rowIndex === 2) {
      alert("Cannot delete the Master Admin user.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete user "${user.userName}"?`)) {
      try {
        setLoading(true);

        const response = await fetch(API_URL, {
          method: 'POST',
          body: new URLSearchParams({
            action: 'delete',
            sheetName: LOGIN_SHEET,
            rowIndex: String(user.rowIndex)
          })
        });

        const result = await response.json();

        if (result.success) {
          alert('User deleted successfully!');
          await fetchUsers(); // Refresh data force refresh
        } else {
          throw new Error(result.error || 'Failed to delete user');
        }
      } catch (error: any) {
        console.error('Error deleting user:', error);
        alert(`Error deleting user: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePageAccessChange = (page: string) => {
    setFormData((prev) => {
      const currentAccess = prev.pageAccess || [];
      if (currentAccess.includes(page)) {
        return { ...prev, pageAccess: currentAccess.filter(p => p !== page) };
      } else {
        return { ...prev, pageAccess: [...currentAccess, page] };
      }
    });
  };

  const togglePasswordVisibility = (userId: number) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.userName.trim()) {
      alert("Please enter user name");
      return;
    }
    if (!formData.userId.trim()) {
      alert("Please enter user ID");
      return;
    }
    if (!formData.password.trim()) {
      alert("Please enter password");
      return;
    }
    if (!formData.role.trim()) {
      alert("Please select role");
      return;
    }

    try {
      setLoading(true);

      // Prepare row data according to sheet columns
      // "Serial No" store in Column "A2:A", "User Name" store in Column "B2:B", "ID" store in Column "C2:C", "Pass" store in Column "D2:D", "Role" store in Column "E2:E", "Page Access" store in Column "F2:F"
      const rowData = [
        formData.serialNo, // Column A - Serial No
        formData.userName, // Column B - User Name
        formData.userId,   // Column C - ID
        formData.password, // Column D - Pass
        formData.role,     // Column E - Role
        formData.pageAccess.map(p => `"${p}"`).join(", ") // Column F - Page Access
      ];

      let response;
      if (editingUser) {
        // Update existing row
        response = await fetch(API_URL, {
          method: 'POST',
          body: new URLSearchParams({
            action: 'update',
            sheetName: LOGIN_SHEET,
            rowIndex: String(editingUser.rowIndex),
            rowData: JSON.stringify(rowData)
          })
        });
      } else {
        // Insert new row
        response = await fetch(API_URL, {
          method: 'POST',
          body: new URLSearchParams({
            action: 'insert',
            sheetName: LOGIN_SHEET,
            rowData: JSON.stringify(rowData)
          })
        });
      }

      const result = await response.json();

      if (result.success) {
        alert(editingUser ? 'User updated successfully!' : 'User created successfully!');

        // Reset form
        setFormData({
          serialNo: "",
          userName: "",
          userId: "",
          password: "",
          role: "User",
          pageAccess: [],
        });

        setEditingUser(null);
        setShowModal(false);

        // Refresh data from sheet
        // Refresh data from sheet
        await fetchUsers();
      } else {
        throw new Error(result.error || 'Failed to save user');
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      alert(`Error saving user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      serialNo: "",
      userName: "",
      userId: "",
      password: "",
      role: "User",
      pageAccess: [],
    });
    setEditingUser(null);
    setShowModal(false);
  };

  if (loading && users.length === 0) {
    return (
        <div className="flex h-full items-center justify-center min-h-[60vh]">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            <span className="ml-3 text-lg font-medium text-gray-600">Loading Settings...</span>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-6">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-gray-700">Loading...</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
          <p className="text-gray-600">Manage system users and permissions</p>
        </div>

        {/* Add New User Button */}
        <div className="mb-6">
          <button
            onClick={handleAddNewUser}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg transition-all hover:bg-blue-700 shadow-md disabled:opacity-50"
            disabled={loading}
          >
            <Plus className="w-5 h-5" />
            Add New User
          </button>
        </div>

        {/* Users Table - Desktop */}
        <div className="hidden lg:block bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-left text-gray-700 uppercase">
                    Serial No
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-left text-gray-700 uppercase">
                    User Name
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-left text-gray-700 uppercase">
                    User ID
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-left text-gray-700 uppercase">
                    Password
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-left text-gray-700 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-left text-gray-700 uppercase">
                    Page Access
                  </th>
                  <th className="px-6 py-4 text-xs font-bold tracking-wider text-left text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {user.serialNo}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {user.userName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {user.userId}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                           <span>
                             {visiblePasswords.has(user.id || 0) ? user.password : "•".repeat((user.password || '').length)}
                           </span>
                           <button
                             onClick={() => togglePasswordVisibility(user.id || 0)}
                             className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                           >
                             {visiblePasswords.has(user.id || 0) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                           </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full ${user.role === "Admin"
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                            }`}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="flex flex-wrap gap-1">
                          {user.pageAccess && user.pageAccess.length > 0 ? (
                            user.pageAccess.map((page, idx) => (
                              <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                                {page}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 italic">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50"
                            disabled={loading}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                            disabled={loading}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col gap-2 items-center">
                        <UserIcon className="w-12 h-12 text-gray-400" />
                        <span>No users found. Add your first user to get started.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Users Cards - Mobile */}
        <div className="lg:hidden space-y-4">
          {users.length > 0 ? (
            users.map((user) => (
              <div key={user.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900">{user.userName}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-gray-600">{user.serialNo}</span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full ${user.role === "Admin"
                            ? "bg-red-100 text-red-800"
                            : "bg-blue-100 text-blue-800"
                          }`}
                      >
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50"
                      disabled={loading}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-900">{user.userId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-900">
                      {visiblePasswords.has(user.id || 0) ? user.password : "•".repeat((user.password || '').length)}
                    </span>
                    <button
                        onClick={() => togglePasswordVisibility(user.id || 0)}
                        className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors ml-1"
                    >
                        {visiblePasswords.has(user.id || 0) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex items-start gap-2">
                    <Layout className="w-4 h-4 text-gray-500 mt-1" />
                    <div className="flex flex-wrap gap-1">
                      {user.pageAccess && user.pageAccess.length > 0 ? (
                        user.pageAccess.map((page, idx) => (
                          <span key={idx} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                            {page}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No pages</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
              <UserIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-500">No users found. Add your first user to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <button
                onClick={handleCancel}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                disabled={loading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Serial Number (read-only for editing, auto-generated for new) */}
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-700">
                  Serial No
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={formData.serialNo}
                    readOnly
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-md bg-gray-100 text-gray-900"
                  />
                </div>
              </div>

              {/* User Name */}
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-700">
                  User Name <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    name="userName"
                    value={formData.userName}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-red-800 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter user name"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* User ID */}
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-700">
                  User ID <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    name="userId"
                    value={formData.userId}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-red-800 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter user ID"
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-700">
                  Password <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-red-800 focus:border-transparent disabled:opacity-50"
                    placeholder="Enter password"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-700">
                  Role <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 w-4 h-4 text-gray-400 transform -translate-y-1/2 pointer-events-none" />
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-3 py-2.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-red-800 focus:border-transparent appearance-none bg-white disabled:opacity-50"
                    disabled={loading}
                  >
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Page Access */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  Page Access
                </label>
                <div className="border border-gray-300 rounded-md p-3 bg-gray-50 max-h-48 overflow-y-auto">
                  {pageOptions.map((page) => (
                    <div key={page} className="flex items-center mb-2 last:mb-0">
                      <input
                        type="checkbox"
                        id={`page-${page}`}
                        checked={formData.pageAccess.includes(page)}
                        onChange={() => handlePageAccessChange(page)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600"
                        disabled={loading}
                      />
                      <label htmlFor={`page-${page}`} className="ml-2 text-sm text-gray-700 cursor-pointer select-none">
                        {page}
                      </label>
                    </div>
                  ))}
                  {pageOptions.length === 0 && (
                    <p className="text-sm text-gray-500 italic">No pages available</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md transition-all hover:bg-blue-700 disabled:opacity-50"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {editingUser ? "Update" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
