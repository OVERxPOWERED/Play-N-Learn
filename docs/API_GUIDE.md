openapi: 3.0.3
info:
  title: Game Session API
  version: 1.0.0
  description: |
    API for managing multiplayer game sessions, player state, and real-time synchronization.
  contact:
    name: Platform Team
    email: platform@example.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.example.com
    description: Production server
  - url: http://localhost:3000
    description: Development server

tags:
  - name: Game Sessions
    description: Game session lifecycle management
  - name: Players
    description: Player management within sessions
  - name: Game State
    description: Real-time game state operations
  - name: WebSocket
    description: Real-time synchronization endpoints

components:
  securitySchemes:
    SessionAuth:
      type: apiKey
      in: cookie
      name: next-auth.session-token
      description: NextAuth.js session cookie
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: Server-to-server API token

  schemas:
    # Core domain models
    Player:
      type: object
      required:
        - id
        - name
        - color
        - isHost
        - connected
        - score
        - joinedAt
      properties:
        id:
          type: string
          format: uuid
          description: Unique player identifier
          example: "550e8400-e29b-41d4-a716-446655440000"
        name:
          type: string
          minLength: 1
          maxLength: 32
          pattern: '^[a-zA-Z0-9_-]+$'
          description: Player display name
          example: "PlayerOne"
        color:
          type: string
          pattern: '^#[0-9A-Fa-f]{6}$'
          description: Player color in hex format
          example: "#FF5733"
        isHost:
          type: boolean
          description: Whether this player is the session host
          example: false
        connected:
          type: boolean
          description: Current connection status
          example: true
        score:
          type: integer
          minimum: 0
          description: Current game score
          example: 1250
        joinedAt:
          type: string
          format: date-time
          description: Timestamp when player joined
          example: "2024-01-15T10:30:00.000Z"
        metadata:
          type: object
          additionalProperties: true
          description: Optional player metadata
          example: { "avatar": "robot", "level": 5 }

    GameSession:
      type: object
      required:
        - id
        - code
        - hostId
        - status
        - maxPlayers
        - players
        - createdAt
        - updatedAt
      properties:
        id:
          type: string
          format: uuid
          description: Unique session identifier
          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        code:
          type: string
          pattern: '^[A-Z0-9]{6}$'
          description: Human-readable session code
          example: "ABC123"
        hostId:
          type: string
          format: uuid
          description: Host player ID
          example: "550e8400-e29b-41d4-a716-446655440000"
        status:
          type: string
          enum: [waiting, starting, active, paused, finished, cancelled]
          description: Current session status
          example: "waiting"
        maxPlayers:
          type: integer
          minimum: 2
          maximum: 8
          description: Maximum number of players
          example: 4
        currentPlayers:
          type: integer
          minimum: 0
          description: Current number of connected players
          example: 2
        players:
          type: array
          items:
            $ref: '#/components/schemas/Player'
          description: Array of players in session
        settings:
          $ref: '#/components/schemas/GameSettings'
        createdAt:
          type: string
          format: date-time
          example: "2024-01-15T10:00:00.000Z"
        updatedAt:
          type: string
          format: date-time
          example: "2024-01-15T10:30:00.000Z"
        startedAt:
          type: string
          format: date-time
          nullable: true
          example: "2024-01-15T10:35:00.000Z"
        finishedAt:
          type: string
          format: date-time
          nullable: true
          example: null

    GameSettings:
      type: object
      required:
        - gameMode
        - difficulty
        - roundTimeLimit
        - maxRounds
      properties:
        gameMode:
          type: string
          enum: [classic, timed, survival, custom]
          example: "classic"
        difficulty:
          type: string
          enum: [easy, medium, hard, expert]
          example: "medium"
        roundTimeLimit:
          type: integer
          minimum: 30
          maximum: 300
          description: Seconds per round
          example: 60
        maxRounds:
          type: integer
          minimum: 1
          maximum: 20
          example: 5
        allowSpectators:
          type: boolean
          default: true
          example: true
        customRules:
          type: object
          additionalProperties: true
          example: { "powerUps": true, "friendlyFire": false }

    GameState:
      type: object
      required:
        - sessionId
        - currentRound
        - roundState
        - playerStates
        - timestamp
        - version
      properties:
        sessionId:
          type: string
          format: uuid
          example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
        currentRound:
          type: integer
          minimum: 0
          example: 2
        roundState:
          type: string
          enum: [waiting, countdown, active, paused, roundEnd, gameEnd]
          example: "active"
        roundStartTime:
          type: string
          format: date-time
          nullable: true
          example: "2024-01-15T10:35:10.000Z"
        roundEndTime:
          type: string
          format: date-time
          nullable: true
          example: null
        playerStates:
          type: array
          items:
            $ref: '#/components/schemas/PlayerState'
        timestamp:
          type: string
          format: date-time
          description: Server timestamp of this state
          example: "2024-01-15T10:36:00.000Z"
        version:
          type: integer
          minimum: 1
          description: Monotonically increasing version for conflict resolution
          example: 42

    PlayerState:
      type: object
      required:
        - playerId
        - position
        - velocity
        - health
        - isAlive
        - lastInput
      properties:
        playerId:
          type: string
          format: uuid
          example: "550e8400-e29b-41d4-a716-446655440000"
        position:
          $ref: '#/components/schemas/Vector2'
        velocity:
          $ref: '#/components/schemas/Vector2'
        health:
          type: integer
          minimum: 0
          maximum: 100
          example: 85
        isAlive:
          type: boolean
          example: true
        lastInput:
          $ref: '#/components/schemas/PlayerInput'
        score:
          type: integer
          minimum: 0
          example: 1250

    Vector2:
      type: object
      required:
        - x
        - y
      properties:
        x:
          type: number
          format: float
          example: 100.5
        y:
          type: number
          format: float
          example: 200.3

    PlayerInput:
      type: object
      required:
        - sequence
        - timestamp
        - actions
      properties:
        sequence:
          type: integer
          minimum: 0
          description: Input sequence number for reconciliation
          example: 15
        timestamp:
          type: string
          format: date-time
          example: "2024-01-15T10:36:00.123Z"
        actions:
          type: object
          properties:
            moveUp:
              type: boolean
            moveDown:
              type: boolean
            moveLeft:
              type: boolean
            moveRight:
              type: boolean
            action1:
              type: boolean
            action2:
              type: boolean

    # Request/Response bodies
    CreateSessionRequest:
      type: object
      required:
        - maxPlayers
        - settings
      properties:
        maxPlayers:
          type: integer
          minimum: 2
          maximum: 8
          example: 4
        settings:
          $ref: '#/components/schemas/GameSettings'
        isPrivate:
          type: boolean
          default: false
          example: false

    CreateSessionResponse:
      type: object
      required:
        - session
        - player
      properties:
        session:
          $ref: '#/components/schemas/GameSession'
        player:
          $ref: '#/components/schemas/Player'

    JoinSessionRequest:
      type: object
      required:
        - code
        - playerName
      properties:
        code:
          type: string
          pattern: '^[A-Z0-9]{6}$'
          example: "ABC123"
        playerName:
          type: string
          minLength: 1
          maxLength: 32
          pattern: '^[a-zA-Z0-9_-]+$'
          example: "PlayerTwo"

    JoinSessionResponse:
      type: object
      required:
        - session
        - player
      properties:
        session:
          $ref: '#/components/schemas/GameSession'
        player:
          $ref: '#/components/schemas/Player'

    UpdateSessionRequest:
      type: object
      properties:
        status:
          type: string
          enum: [waiting, starting, active, paused, finished, cancelled]
        settings:
          $ref: '#/components/schemas/GameSettings'
        maxPlayers:
          type: integer
          minimum: 2
          maximum: 8

    UpdatePlayerRequest:
      type: object
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 32
          pattern: '^[a-zA-Z0-9_-]+$'
        color:
          type: string
          pattern: '^#[0-9A-Fa-f]{6}$'
        metadata:
          type: object
          additionalProperties: true

    SubmitInputRequest:
      type: object
      required:
        - inputs
      properties:
        inputs:
          type: array
          items:
            $ref: '#/components/schemas/PlayerInput'
          minItems: 1
          maxItems: 60

    SubmitInputResponse:
      type: object
      required:
        - acknowledged
        - serverVersion
      properties:
        acknowledged:
          type: array
          items:
            type: integer
          description: Sequence numbers acknowledged by server
          example: [15, 16, 17]
        serverVersion:
          type: integer
          description: Latest server game state version
          example: 45

    ErrorResponse:
      type: object
      required:
        - error
        - message
        - statusCode
        - timestamp
      properties:
        error:
          type: string
          example: "VALIDATION_ERROR"
        message:
          type: string
          example: "Invalid session code format"
        statusCode:
          type: integer
          example: 400
        timestamp:
          type: string
          format: date-time
          example: "2024-01-15T10:30:00.000Z"
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
              code:
                type: string

    PaginatedResponse:
      type: object
      required:
        - data
        - pagination
      properties:
        data:
          type: array
          items:
            type: object
        pagination:
          type: object
          required:
            - page
            - limit
            - total
            - totalPages
          properties:
            page:
              type: integer
              example: 1
            limit:
              type: integer
              example: 20
            total:
              type: integer
              example: 150
            totalPages:
              type: integer
              example: 8

  parameters:
    SessionIdParam:
      name: id
      in: path
      required: true
      schema:
        type: string
        format: uuid
      description: Game session UUID

    PlayerIdParam:
      name: playerId
      in: path
      required: true
      schema:
        type: string
        format: uuid
      description: Player UUID

    PaginationParams:
      - name: page
        in: query
        schema:
          type: integer
          minimum: 1
          default: 1
      - name: limit
        in: query
        schema:
          type: integer
          minimum: 1
          maximum: 100
          default: 20
      - name: sort
        in: query
        schema:
          type: string
          enum: [createdAt, updatedAt, code, status]
          default: createdAt
      - name: order
        in: query
        schema:
          type: string
          enum: [asc, desc]
          default: desc

paths:
  /api/game-sessions:
    get:
      tags: [Game Sessions]
      summary: List game sessions
      description: |
        Retrieve a paginated list of game sessions. Supports filtering by status.
        Requires authentication.
      security:
        - SessionAuth: []
      parameters:
        - $ref: '#/components/parameters/PaginationParams'
        - name: status
          in: query
          schema:
            type: string
            enum: [waiting, starting, active, paused, finished, cancelled]
          description: Filter by session status
        - name: hostId
          in: query
          schema:
            type: string
            format: uuid
          description: Filter by host player ID
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaginatedResponse'
              example:
                data:
                  - id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                    code: "ABC123"
                    hostId: "550e8400-e29b-41d4-a716-446655440000"
                    status: "waiting"
                    maxPlayers: 4
                    currentPlayers: 2
                    players: []
                    settings:
                      gameMode: "classic"
                      difficulty: "medium"
                      roundTimeLimit: 60
                      maxRounds: 5
                    createdAt: "2024-01-15T10:00:00.0