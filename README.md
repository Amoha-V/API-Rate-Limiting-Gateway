# API Gateway Project

This project is an API Gateway that serves as a single entry point for various backend services. It handles incoming requests, manages authentication, implements rate limiting, and connects to a Redis database for data storage.

## Project Structure

```
api-gateway
├── gateway
│   ├── main.py          # Entry point of the API gateway application
│   ├── config.py        # Configuration settings for the API gateway
│   ├── auth.py          # Authentication logic
│   ├── rate_limiter.py  # Rate limiting functionality
│   ├── redis_client.py   # Redis database connection management
│   └── requirements.txt  # Python dependencies
├── admin-api
│   ├── server.js        # Entry point for the admin API
│   ├── config.js        # Configuration settings for the admin API
│   ├── auth.js          # Authentication for the admin API
│   └── package.json file     # npm configuration for the admin API
├── frontend
│   ├── src
│   │   ├── App.js       # Main component of the frontend application
│   │   ├── Dashboard.js  # Dashboard component
│   │   ├── Login.js      # Login component
│   │   └── api.js        # API call functions
│   ├── public
│   │   └── index.html    # Main HTML file for the frontend
│   └── package.json       # npm configuration for the frontend
└── README.md             # Project documentation
```

## Setup Instructions

1. **Clone the repository:**

   ```
   git clone <repository-url>
   cd api-gateway
   ```

2. **Set up the backend:**

   - Navigate to the `gateway` directory and install the required Python packages:
     ```
     pip install -r requirements.txt
     ```

3. **Set up the admin API:**

   - Navigate to the `admin-api` directory and install the required npm packages:
     ```
     npm install
     ```

4. **Set up the frontend:**
   - Navigate to the `frontend` directory and install the required npm packages:
     ```
     npm install
     ```

## Usage Guidelines

- Start the API gateway by running `main.py` in the `gateway` directory.
- Start the admin API by running `server.js` in the `admin-api` directory.
- Start the frontend application by running the appropriate command in the `frontend` directory (e.g., `npm start`).

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.
