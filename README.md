# Upload Server with Node.js and Express

This is a simple Node.js server built using the Express framework to handle file uploads in batches. It follows a three-step process:

1. Initialize Upload Session
   - `POST /api/upload/sessions`: Initiates a new upload session and returns a unique session ID.
2. Unique Data Batches
   - `POST /api/upload/sessions/:sessionId`: Uploads data batches for a specific session, identified by the session ID and sequence number.
3. Finalize Upload Session
   - `POST /api/upload/sessions/:sessionId/finish`: Finalizes the upload session by checking for missing data batches, merging the received batches, and saving the final file.

### Prerequisites

- Node.js installed on your machine

### Getting Started

1. Clone the repository.
2. Install dependencies by running npm install.
3. Start the server with npm start.

### API Endpoints

1. Initialized Upload Session

- Endpoint: `POST /api/upload/sessions`
- Request Body:

```
{
  "totalRecord": 100000
}
```

- Response:

```
 {
"sessionId": "unique_session_id"
}
```

2. Upload Data Bathces

- Endpoint: `POST /api/upload/sessions/:sessionId`
- Request Params:
  - `sessionId`: The unique session ID obtained from the initialization step.
- Request Body:

```
{
  "seqNum": 0,
  "data": ["batch_data_item_1", "batch_data_item_2", ...]
}
```

- Response
  - Status: `204 No Content`

3. Finalize Upload Session

- Endpoint: `POST /api/upload/sessions/:sessionId/finish`
- Request Params:
  - `sessionId`: The unique session ID obtained from the initialization step.
- Response:

```
{
  "sessionId": "unique_session_id",
  "validationResult": "Success" or "Failed"
}
```

### Example Usage

1. Initial Upload Sesion:

```
curl -X POST http://localhost:3000/api/upload/sessions -H "Content-Type: application/json" -d '{"totalRecord": 100000}'
```

2. Upload Data Batches:

```
curl -X POST http://localhost:3000/api/upload/sessions/unique_session_id -H "Content-Type: application/json" -d '{"seqNum": 0, "data": ["batch_data_item_1", "batch_data_item_2", ...]}'
```

3. Finalize Upload Batches:

```
curl -X POST http://localhost:3000/api/upload/sessions/unique_session_id/finish
```
