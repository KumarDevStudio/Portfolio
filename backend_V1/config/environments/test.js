{
  "info": {
    "name": "PortfolioDB",
    "description": "Complete API collection for Portfolio Backend with authentication, CRUD operations, file uploads, and more.",
    "version": "1.0.0",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{access_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5000/api",
      "type": "string"
    },
    {
      "key": "access_token",
      "value": "",
      "type": "string"
    },
    {
      "key": "refresh_token",
      "value": "",
      "type": "string"
    },
    {
      "key": "admin_id",
      "value": "",
      "type": "string"
    }
  ],
  "item": [
    {
      "name": "🏥 Health Check",
      "item": [
        {
          "name": "Health Check",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/health",
              "host": ["{{base_url}}"],
              "path": ["health"]
            }
          },
          "response": []
        }
      ]
    },
    {
      "name": "🔐 Authentication",
      "item": [
        {
          "name": "Admin Login",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (pm.response.code === 200) {",
                  "    const response = pm.response.json();",
                  "    pm.collectionVariables.set('access_token', response.accessToken);",
                  "    pm.collectionVariables.set('refresh_token', response.refreshToken);",
                  "    pm.collectionVariables.set('admin_id', response.admin.id);",
                  "    console.log('Tokens saved successfully');",
                  "}"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"username\": \"admin\",\n    \"password\": \"admin123\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/admin/login",
              "host": ["{{base_url}}"],
              "path": ["admin", "login"]
            }
          }
        },
        {
          "name": "Refresh Token",
          "event": [
            {
              "listen": "test",
              "script": {
                "exec": [
                  "if (pm.response.code === 200) {",
                  "    const response = pm.response.json();",
                  "    pm.collectionVariables.set('access_token', response.accessToken);",
                  "    console.log('Access token refreshed');",
                  "}"
                ]
              }
            }
          ],
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"refreshToken\": \"{{refresh_token}}\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/admin/refresh",
              "host": ["{{base_url}}"],
              "path": ["admin", "refresh"]
            }
          }
        },
        {
          "name": "Admin Logout",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"refreshToken\": \"{{refresh_token}}\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/admin/logout",
              "host": ["{{base_url}}"],
              "path": ["admin", "logout"]
            }
          }
        }
      ]
    },
    {
      "name": "👤 Admin Profile",
      "item": [
        {
          "name": "Get Profile",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/admin/profile",
              "host": ["{{base_url}}"],
              "path": ["admin", "profile"]
            }
          }
        },
        {
          "name": "Update Profile",
          "request": {
            "method": "PUT",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"firstName\": \"John\",\n    \"lastName\": \"Doe\",\n    \"email\": \"john.doe@example.com\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/admin/profile",
              "host": ["{{base_url}}"],
              "path": ["admin", "profile"]
            }
          }
        },
        {
          "name": "Change Password",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"currentPassword\": \"admin123\",\n    \"newPassword\": \"newPassword123\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/admin/change-password",
              "host": ["{{base_url}}"],
              "path": ["admin", "change-password"]
            }
          }
        },
        {
          "name": "Create Admin (Super Admin Only)",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"username\": \"newadmin\",\n    \"email\": \"newadmin@example.com\",\n    \"password\": \"password123\",\n    \"firstName\": \"New\",\n    \"lastName\": \"Admin\",\n    \"role\": \"admin\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/admin/create",
              "host": ["{{base_url}}"],
              "path": ["admin", "create"]
            }
          }
        },
        {
          "name": "Get All Admins (Super Admin Only)",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/admin/all",
              "host": ["{{base_url}}"],
              "path": ["admin", "all"]
            }
          }
        }
      ]
    },
    {
      "name": "📞 Contacts",
      "item": [
        {
          "name": "📝 Public - Submit Contact Form",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"name\": \"John Doe\",\n    \"email\": \"john.doe@example.com\",\n    \"subject\": \"Interested in your services\",\n    \"message\": \"Hi there! I'm interested in discussing a potential project collaboration. Could we schedule a call to discuss further?\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/contacts",
              "host": ["{{base_url}}"],
              "path": ["contacts"]
            }
          }
        },
        {
          "name": "🔒 Admin - Get All Contacts",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/contacts?page=1&limit=10&status=new&search=john",
              "host": ["{{base_url}}"],
              "path": ["contacts"],
              "query": [
                {
                  "key": "page",
                  "value": "1"
                },
                {
                  "key": "limit",
                  "value": "10"
                },
                {
                  "key": "status",
                  "value": "new"
                },
                {
                  "key": "search",
                  "value": "john"
                }
              ]
            }
          }
        },
        {
          "name": "🔒 Admin - Get Contact by ID",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/contacts/{{contact_id}}",
              "host": ["{{base_url}}"],
              "path": ["contacts", "{{contact_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Update Contact Status",
          "request": {
            "method": "PATCH",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"status\": \"read\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/contacts/{{contact_id}}/status",
              "host": ["{{base_url}}"],
              "path": ["contacts", "{{contact_id}}", "status"]
            }
          }
        },
        {
          "name": "🔒 Admin - Delete Contact",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/contacts/{{contact_id}}",
              "host": ["{{base_url}}"],
              "path": ["contacts", "{{contact_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Get Contact Statistics",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/contacts/stats",
              "host": ["{{base_url}}"],
              "path": ["contacts", "stats"]
            }
          }
        }
      ]
    },
    {
      "name": "💼 Projects",
      "item": [
        {
          "name": "📖 Public - Get Published Projects",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/projects/published?category=web&featured=true&limit=10",
              "host": ["{{base_url}}"],
              "path": ["projects", "published"],
              "query": [
                {
                  "key": "category",
                  "value": "web"
                },
                {
                  "key": "featured",
                  "value": "true"
                },
                {
                  "key": "limit",
                  "value": "10"
                }
              ]
            }
          }
        },
        {
          "name": "📖 Public - Get Published Project by ID",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/projects/published/{{project_id}}",
              "host": ["{{base_url}}"],
              "path": ["projects", "published", "{{project_id}}"]
            }
          }
        },
        {
          "name": "📖 Public - Get Project Categories",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/projects/categories",
              "host": ["{{base_url}}"],
              "path": ["projects", "categories"]
            }
          }
        },
        {
          "name": "🔒 Admin - Get All Projects",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/projects?page=1&limit=10&status=published&category=web&search=portfolio",
              "host": ["{{base_url}}"],
              "path": ["projects"],
              "query": [
                {
                  "key": "page",
                  "value": "1"
                },
                {
                  "key": "limit",
                  "value": "10"
                },
                {
                  "key": "status",
                  "value": "published"
                },
                {
                  "key": "category",
                  "value": "web"
                },
                {
                  "key": "search",
                  "value": "portfolio"
                }
              ]
            }
          }
        },
        {
          "name": "🔒 Admin - Get Project by ID",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/projects/{{project_id}}",
              "host": ["{{base_url}}"],
              "path": ["projects", "{{project_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Create Project",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"title\": \"Portfolio Website\",\n    \"description\": \"A modern, responsive portfolio website built with React and Node.js. Features include project showcase, skills display, contact form, and admin dashboard for content management.\",\n    \"shortDescription\": \"Modern portfolio website with admin dashboard\",\n    \"technologies\": [\"React\", \"Node.js\", \"MongoDB\", \"Express\", \"JWT\"],\n    \"liveUrl\": \"https://myportfolio.com\",\n    \"githubUrl\": \"https://github.com/user/portfolio\",\n    \"category\": \"web\",\n    \"status\": \"published\",\n    \"featured\": true,\n    \"order\": 1\n}"
            },
            "url": {
              "raw": "{{base_url}}/projects",
              "host": ["{{base_url}}"],
              "path": ["projects"]
            }
          }
        },
        {
          "name": "🔒 Admin - Update Project",
          "request": {
            "method": "PUT",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"title\": \"Updated Portfolio Website\",\n    \"description\": \"Updated description for the portfolio website with new features and improvements.\",\n    \"shortDescription\": \"Updated modern portfolio website\",\n    \"technologies\": [\"React\", \"Node.js\", \"MongoDB\", \"Express\", \"JWT\", \"Docker\"],\n    \"liveUrl\": \"https://myportfolio.com\",\n    \"githubUrl\": \"https://github.com/user/portfolio\",\n    \"category\": \"web\",\n    \"status\": \"published\",\n    \"featured\": true,\n    \"order\": 1\n}"
            },
            "url": {
              "raw": "{{base_url}}/projects/{{project_id}}",
              "host": ["{{base_url}}"],
              "path": ["projects", "{{project_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Update Project Images",
          "request": {
            "method": "PATCH",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"images\": [\n        {\n            \"filename\": \"project-1234567890.jpg\",\n            \"originalName\": \"portfolio-screenshot.jpg\",\n            \"url\": \"/uploads/project-1234567890.jpg\",\n            \"size\": 1024000\n        }\n    ]\n}"
            },
            "url": {
              "raw": "{{base_url}}/projects/{{project_id}}/images",
              "host": ["{{base_url}}"],
              "path": ["projects", "{{project_id}}", "images"]
            }
          }
        },
        {
          "name": "🔒 Admin - Delete Project",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/projects/{{project_id}}",
              "host": ["{{base_url}}"],
              "path": ["projects", "{{project_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Get Project Statistics",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/projects/stats",
              "host": ["{{base_url}}"],
              "path": ["projects", "stats"]
            }
          }
        }
      ]
    },
    {
      "name": "🛠 Skills",
      "item": [
        {
          "name": "📖 Public - Get Active Skills",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/skills/active?category=frontend",
              "host": ["{{base_url}}"],
              "path": ["skills", "active"],
              "query": [
                {
                  "key": "category",
                  "value": "frontend"
                }
              ]
            }
          }
        },
        {
          "name": "📖 Public - Get Skill Categories",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/skills/categories",
              "host": ["{{base_url}}"],
              "path": ["skills", "categories"]
            }
          }
        },
        {
          "name": "🔒 Admin - Get All Skills",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/skills?page=1&limit=20&category=frontend&status=active&search=react",
              "host": ["{{base_url}}"],
              "path": ["skills"],
              "query": [
                {
                  "key": "page",
                  "value": "1"
                },
                {
                  "key": "limit",
                  "value": "20"
                },
                {
                  "key": "category",
                  "value": "frontend"
                },
                {
                  "key": "status",
                  "value": "active"
                },
                {
                  "key": "search",
                  "value": "react"
                }
              ]
            }
          }
        },
        {
          "name": "🔒 Admin - Get Skill by ID",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/skills/{{skill_id}}",
              "host": ["{{base_url}}"],
              "path": ["skills", "{{skill_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Create Skill",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"name\": \"React.js\",\n    \"category\": \"frontend\",\n    \"proficiency\": 90,\n    \"icon\": \"react\",\n    \"color\": \"#61DAFB\",\n    \"yearsOfExperience\": 3,\n    \"status\": \"active\",\n    \"order\": 1\n}"
            },
            "url": {
              "raw": "{{base_url}}/skills",
              "host": ["{{base_url}}"],
              "path": ["skills"]
            }
          }
        },
        {
          "name": "🔒 Admin - Update Skill",
          "request": {
            "method": "PUT",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"name\": \"React.js\",\n    \"category\": \"frontend\",\n    \"proficiency\": 95,\n    \"icon\": \"react\",\n    \"color\": \"#61DAFB\",\n    \"yearsOfExperience\": 4,\n    \"status\": \"active\",\n    \"order\": 1\n}"
            },
            "url": {
              "raw": "{{base_url}}/skills/{{skill_id}}",
              "host": ["{{base_url}}"],
              "path": ["skills", "{{skill_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Update Skill Order",
          "request": {
            "method": "PATCH",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"skills\": [\n        {\"id\": \"skill_id_1\", \"order\": 1},\n        {\"id\": \"skill_id_2\", \"order\": 2},\n        {\"id\": \"skill_id_3\", \"order\": 3}\n    ]\n}"
            },
            "url": {
              "raw": "{{base_url}}/skills/order",
              "host": ["{{base_url}}"],
              "path": ["skills", "order"]
            }
          }
        },
        {
          "name": "🔒 Admin - Delete Skill",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/skills/{{skill_id}}",
              "host": ["{{base_url}}"],
              "path": ["skills", "{{skill_id}}"]
            }
          }
        }
      ]
    },
    {
      "name": "💼 Experience",
      "item": [
        {
          "name": "📖 Public - Get Active Experiences",
          "request": {
            "method": "GET",
            "header": [],
            "url": {
              "raw": "{{base_url}}/experiences/active",
              "host": ["{{base_url}}"],
              "path": ["experiences", "active"]
            }
          }
        },
        {
          "name": "🔒 Admin - Get All Experiences",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/experiences?page=1&limit=10&status=active&search=developer",
              "host": ["{{base_url}}"],
              "path": ["experiences"],
              "query": [
                {
                  "key": "page",
                  "value": "1"
                },
                {
                  "key": "limit",
                  "value": "10"
                },
                {
                  "key": "status",
                  "value": "active"
                },
                {
                  "key": "search",
                  "value": "developer"
                }
              ]
            }
          }
        },
        {
          "name": "🔒 Admin - Get Experience by ID",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/experiences/{{experience_id}}",
              "host": ["{{base_url}}"],
              "path": ["experiences", "{{experience_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Create Experience",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"company\": \"Tech Solutions Inc.\",\n    \"position\": \"Senior Full Stack Developer\",\n    \"location\": \"San Francisco, CA\",\n    \"description\": \"Led development of web applications using modern technologies. Collaborated with cross-functional teams to deliver high-quality software solutions.\",\n    \"responsibilities\": [\n        \"Developed and maintained React.js applications\",\n        \"Built RESTful APIs using Node.js and Express\",\n        \"Implemented database designs with MongoDB\",\n        \"Mentored junior developers\"\n    ],\n    \"technologies\": [\"React\", \"Node.js\", \"MongoDB\", \"Express\", \"AWS\"],\n    \"startDate\": \"2021-01-15\",\n    \"endDate\": \"2023-06-30\",\n    \"current\": false,\n    \"type\": \"fulltime\",\n    \"companyUrl\": \"https://techsolutions.com\",\n    \"status\": \"active\",\n    \"order\": 1\n}"
            },
            "url": {
              "raw": "{{base_url}}/experiences/{{experience_id}}",
              "host": ["{{base_url}}"],
              "path": ["experiences", "{{experience_id}}"]
            }
          }
        },
        {
          "name": "🔒 Admin - Delete Experience",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/experiences/{{experience_id}}",
              "host": ["{{base_url}}"],
              "path": ["experiences", "{{experience_id}}"]
            }
          }
        }
      ]
    },
    {
      "name": "📁 File Uploads",
      "item": [
        {
          "name": "🔒 Admin - Upload Single File",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "body": {
              "mode": "formdata",
              "formdata": [
                {
                  "key": "file",
                  "type": "file",
                  "src": [],
                  "description": "Select an image file to upload"
                }
              ]
            },
            "url": {
              "raw": "{{base_url}}/uploads/single",
              "host": ["{{base_url}}"],
              "path": ["uploads", "single"]
            }
          }
        },
        {
          "name": "🔒 Admin - Upload Multiple Files",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "body": {
              "mode": "formdata",
              "formdata": [
                {
                  "key": "files",
                  "type": "file",
                  "src": [],
                  "description": "Select multiple image files to upload"
                },
                {
                  "key": "files",
                  "type": "file",
                  "src": [],
                  "description": "Additional file (optional)"
                }
              ]
            },
            "url": {
              "raw": "{{base_url}}/uploads/multiple",
              "host": ["{{base_url}}"],
              "path": ["uploads", "multiple"]
            }
          }
        },
        {
          "name": "🔒 Admin - Get File Info",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/uploads/{{filename}}/info",
              "host": ["{{base_url}}"],
              "path": ["uploads", "{{filename}}", "info"]
            }
          }
        },
        {
          "name": "🔒 Admin - Delete File",
          "request": {
            "method": "DELETE",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/uploads/{{filename}}",
              "host": ["{{base_url}}"],
              "path": ["uploads", "{{filename}}"]
            }
          }
        }
      ]
    },
    {
      "name": "🧪 Test Examples",
      "item": [
        {
          "name": "Create Complete Project Workflow",
          "item": [
            {
              "name": "1. Upload Project Images",
              "event": [
                {
                  "listen": "test",
                  "script": {
                    "exec": [
                      "if (pm.response.code === 200) {",
                      "    const response = pm.response.json();",
                      "    pm.collectionVariables.set('uploaded_files', JSON.stringify(response.files));",
                      "    console.log('Files uploaded:', response.files.length);",
                      "}"
                    ]
                  }
                }
              ],
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "Authorization",
                    "value": "Bearer {{access_token}}"
                  }
                ],
                "body": {
                  "mode": "formdata",
                  "formdata": [
                    {
                      "key": "files",
                      "type": "file",
                      "src": []
                    }
                  ]
                },
                "url": {
                  "raw": "{{base_url}}/uploads/multiple",
                  "host": ["{{base_url}}"],
                  "path": ["uploads", "multiple"]
                }
              }
            },
            {
              "name": "2. Create Project with Images",
              "event": [
                {
                  "listen": "pre-request",
                  "script": {
                    "exec": [
                      "const uploadedFiles = pm.collectionVariables.get('uploaded_files');",
                      "if (uploadedFiles) {",
                      "    const files = JSON.parse(uploadedFiles);",
                      "    const projectData = {",
                      "        title: 'E-commerce Platform',",
                      "        description: 'Full-stack e-commerce platform with payment integration, admin dashboard, and customer management.',",
                      "        shortDescription: 'Modern e-commerce platform',",
                      "        technologies: ['React', 'Node.js', 'MongoDB', 'Stripe', 'JWT'],",
                      "        images: files,",
                      "        liveUrl: 'https://myecommerce.com',",
                      "        githubUrl: 'https://github.com/user/ecommerce',",
                      "        category: 'web',",
                      "        status: 'published',",
                      "        featured: true,",
                      "        order: 1",
                      "    };",
                      "    pm.request.body.raw = JSON.stringify(projectData);",
                      "}"
                    ]
                  }
                },
                {
                  "listen": "test",
                  "script": {
                    "exec": [
                      "if (pm.response.code === 201) {",
                      "    const response = pm.response.json();",
                      "    pm.collectionVariables.set('project_id', response._id);",
                      "    console.log('Project created with ID:', response._id);",
                      "}"
                    ]
                  }
                }
              ],
              "request": {
                "method": "POST",
                "header": [
                  {
                    "key": "Authorization",
                    "value": "Bearer {{access_token}}"
                  },
                  {
                    "key": "Content-Type",
                    "value": "application/json"
                  }
                ],
                "body": {
                  "mode": "raw",
                  "raw": ""
                },
                "url": {
                  "raw": "{{base_url}}/projects",
                  "host": ["{{base_url}}"],
                  "path": ["projects"]
                }
              }
            }
          ]
        },
        {
          "name": "Bulk Create Skills",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "[\n    {\n        \"name\": \"JavaScript\",\n        \"category\": \"language\",\n        \"proficiency\": 95,\n        \"icon\": \"javascript\",\n        \"color\": \"#F7DF1E\",\n        \"yearsOfExperience\": 5,\n        \"status\": \"active\",\n        \"order\": 1\n    },\n    {\n        \"name\": \"Python\",\n        \"category\": \"language\",\n        \"proficiency\": 85,\n        \"icon\": \"python\",\n        \"color\": \"#3776AB\",\n        \"yearsOfExperience\": 3,\n        \"status\": \"active\",\n        \"order\": 2\n    },\n    {\n        \"name\": \"React.js\",\n        \"category\": \"frontend\",\n        \"proficiency\": 90,\n        \"icon\": \"react\",\n        \"color\": \"#61DAFB\",\n        \"yearsOfExperience\": 4,\n        \"status\": \"active\",\n        \"order\": 3\n    }\n]"
            },
            "url": {
              "raw": "{{base_url}}/skills/bulk",
              "host": ["{{base_url}}"],
              "path": ["skills", "bulk"]
            }
          }
        }
      ]
    },
    {
      "name": "📊 Analytics & Reports",
      "item": [
        {
          "name": "🔒 Admin - Dashboard Overview",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/admin/dashboard",
              "host": ["{{base_url}}"],
              "path": ["admin", "dashboard"]
            }
          }
        },
        {
          "name": "🔒 Admin - Contact Analytics",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/contacts/stats",
              "host": ["{{base_url}}"],
              "path": ["contacts", "stats"]
            }
          }
        },
        {
          "name": "🔒 Admin - Project Analytics",
          "request": {
            "method": "GET",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              }
            ],
            "url": {
              "raw": "{{base_url}}/projects/stats",
              "host": ["{{base_url}}"],
              "path": ["projects", "stats"]
            }
          }
        }
      ]
    }
  ],
  "event": [
    {
      "listen": "prerequest",
      "script": {
        "type": "text/javascript",
        "exec": [
          "// Auto-refresh token if expired",
          "const token = pm.collectionVariables.get('access_token');",
          "const refreshToken = pm.collectionVariables.get('refresh_token');",
          "",
          "if (!token && refreshToken && pm.request.url.path.join('/') !== 'admin/login') {",
          "    console.log('No access token found, attempting to refresh...');",
          "    ",
          "    const refreshRequest = {",
          "        url: pm.collectionVariables.get('base_url') + '/admin/refresh',",
          "        method: 'POST',",
          "        header: {",
          "            'Content-Type': 'application/json'",
          "        },",
          "        body: {",
          "            mode: 'raw',",
          "            raw: JSON.stringify({",
          "                refreshToken: refreshToken",
          "            })",
          "        }",
          "    };",
          "    ",
          "    pm.sendRequest(refreshRequest, (err, res) => {",
          "        if (err) {",
          "            console.log('Error refreshing token:', err);",
          "        } else if (res.code === 200) {",
          "            const responseData = res.json();",
          "            pm.collectionVariables.set('access_token', responseData.accessToken);",
          "            console.log('Token refreshed successfully');",
          "        } else {",
          "            console.log('Failed to refresh token:', res.code, res.json());",
          "        }",
          "    });",
          "}"
        ]
      }
    },
    {
      "listen": "test",
      "script": {
        "type": "text/javascript",
        "exec": [
          "// Global test scripts",
          "pm.test('Response time is less than 2000ms', function () {",
          "    pm.expect(pm.response.responseTime).to.be.below(2000);",
          "});",
          "",
          "pm.test('Response has proper headers', function () {",
          "    pm.expect(pm.response.headers.has('Content-Type')).to.be.true;",
          "});",
          "",
          "// Handle 401 errors by clearing tokens",
          "if (pm.response.code === 401) {",
          "    console.log('Unauthorized response, clearing tokens');",
          "    pm.collectionVariables.unset('access_token');",
          "}"
        ]
      }
    }
  ]
}",\n    \"endDate\": \"2023-06-30\",\n    \"current\": false,\n    \"type\": \"fulltime\",\n    \"companyUrl\": \"https://techsolutions.com\",\n    \"status\": \"active\",\n    \"order\": 1\n}"
            },
            "url": {
              "raw": "{{base_url}}/experiences",
              "host": ["{{base_url}}"],
              "path": ["experiences"]
            }
          }
        },
        {
          "name": "🔒 Admin - Update Experience",
          "request": {
            "method": "PUT",
            "header": [
              {
                "key": "Authorization",
                "value": "Bearer {{access_token}}"
              },
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n    \"company\": \"Tech Solutions Inc.\",\n    \"position\": \"Senior Full Stack Developer\",\n    \"location\": \"San Francisco, CA (Remote)\",\n    \"description\": \"Led development of web applications using modern technologies. Collaborated with cross-functional teams to deliver high-quality software solutions. Managed remote team during COVID-19.\",\n    \"responsibilities\": [\n        \"Developed and maintained React.js applications\",\n        \"Built RESTful APIs using Node.js and Express\",\n        \"Implemented database designs with MongoDB\",\n        \"Mentored junior developers\",\n        \"Led remote development team\"\n    ],\n    \"technologies\": [\"React\", \"Node.js\", \"MongoDB\", \"Express\", \"AWS\", \"Docker\"],\n    \"startDate\": \"2021-01-15\