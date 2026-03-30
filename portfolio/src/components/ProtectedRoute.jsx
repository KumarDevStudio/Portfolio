const ProtectedRoute = ({ children, userRole, token, isTokenValid, isLoadingAuth }) => {
  const location = useLocation();

  // Show loading spinner while validating authentication
  if (isLoadingAuth) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!token || isTokenValid === false) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  // Redirect viewers to contacts page if trying to access restricted pages
  if (userRole === 'viewer' && !['/admin/contacts'].includes(location.pathname)) {
    return <Navigate to="/admin/contacts" replace />;
  }

  return children;
};