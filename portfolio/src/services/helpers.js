// Sanitize input to prevent XSS attacks
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  // Basic XSS prevention: strip HTML tags and encode special characters
  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML
    .replace(/<[^>]+>/g, '')
    .replace(/[&<>"']/g, (match) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[match]));
};

// Validate URL format
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Handle file uploads to the backend
export const uploadFile = async (file, token) => {
  if (!file) throw new Error('No file provided');
  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    throw new Error('Only PNG and JPEG images are allowed');
  }
  if (file.size > 5 * 1024 * 1024) { // 5MB limit
    throw new Error('File size exceeds 5MB limit');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('http://localhost:5000/api/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'File upload failed');
    }

    const data = await response.json();
    return data.data.publicId; // Assumes backend returns { data: { publicId: string } }
  } catch (err) {
    throw new Error(err.message || 'Failed to upload file');
  }
};