# Civil Defence Expo - Architecture Diagrams

## System Overview

```mermaid
graph TB
    subgraph Users
        PU[Public Users]
        CM[Community Members]
        CA[Community Admins]
    end
    
    subgraph Frontend - PWA
        UI[Next.js App]
        SW[Service Worker]
        LS[Local Storage]
        IDB[IndexedDB]
        
        UI <--> SW
        SW <--> LS
        SW <--> IDB
    end
    
    subgraph Backend - Supabase
        AUTH[Supabase Auth]
        DB[PostgreSQL + RLS]
        STORAGE[File Storage]
        RT[Realtime]
        
        AUTH --> DB
        STORAGE --> DB
        RT --> DB
    end
    
    PU --> UI
    CM --> UI
    CA --> UI
    
    SW <--> AUTH
    SW <--> DB
    SW <--> STORAGE
    SW <--> RT
    
    style Frontend - PWA fill:#e1f5e1
    style Backend - Supabase fill:#e1e5f5
```

## Data Flow Architecture

```mermaid
flowchart TD
    subgraph User Actions
        UA1[View Public Info]
        UA2[Join Community]
        UA3[Create Content]
        UA4[Admin Actions]
    end
    
    subgraph Local Layer
        LC[Local Cache Check]
        LW[Local Write]
        SQ[Sync Queue]
    end
    
    subgraph Network Layer
        ON{Online?}
        API[API Call]
        SUP[Supabase]
    end
    
    subgraph Response Flow
        RES[Response]
        US[Update Store]
        UUI[Update UI]
    end
    
    UA1 --> LC
    UA2 --> LC
    UA3 --> LC
    UA4 --> LC
    
    LC -->|Cache Hit| UUI
    LC -->|Cache Miss| ON
    
    ON -->|Yes| API
    ON -->|No| LW
    
    LW --> SQ
    LW --> UUI
    
    API --> SUP
    SUP --> RES
    RES --> US
    US --> UUI
    
    SQ -.->|When Online| API
```

## Offline Sync Strategy

```mermaid
sequenceDiagram
    participant User
    participant App
    participant LocalDB
    participant SyncQueue
    participant Supabase
    
    Note over User,Supabase: User Goes Offline
    
    User->>App: Create/Update Data
    App->>LocalDB: Save Locally
    App->>SyncQueue: Add to Queue
    App->>User: Show Success (Optimistic)
    
    Note over User,Supabase: Connection Restored
    
    SyncQueue->>App: Process Queue
    loop For Each Queued Item
        App->>Supabase: Sync Data
        alt Success
            Supabase-->>App: Confirm
            App->>LocalDB: Mark Synced
            App->>SyncQueue: Remove Item
        else Conflict
            Supabase-->>App: Conflict Data
            App->>User: Resolve Conflict
            User->>App: Choose Resolution
            App->>Supabase: Send Resolution
        end
    end
    App->>User: Sync Complete
```

## Component Architecture

```mermaid
graph TB
    subgraph Pages
        HP[Home Page]
        LP[Login Page]
        DP[Dashboard Page]
        CP[Community Page]
        AP[Admin Page]
    end
    
    subgraph Layouts
        PL[Public Layout]
        AL[Auth Layout]
        ADL[Admin Layout]
    end
    
    subgraph Features
        subgraph Public
            PI[Public Info]
            RS[Risk Section]
            RG[Resources Grid]
        end
        
        subgraph Community
            CL[Community List]
            CC[Community Card]
            CD[Community Detail]
            CM[Community Members]
        end
        
        subgraph Admin
            UM[User Management]
            CS[Community Settings]
            AN[Announcements]
        end
    end
    
    subgraph Core Components
        NAV[Navigation]
        OFF[Offline Banner]
        LDR[Loader]
        BTN[Button]
        CRD[Card]
        FRM[Form]
    end
    
    HP --> PL
    LP --> PL
    DP --> AL
    CP --> AL
    AP --> ADL
    
    PL --> NAV
    AL --> NAV
    ADL --> NAV
    
    HP --> PI
    HP --> RS
    
    DP --> CL
    CL --> CC
    
    CP --> CD
    CP --> CM
    
    AP --> UM
    AP --> CS
```

## Database Schema

```mermaid
erDiagram
    users ||--o{ community_members : "belongs to"
    communities ||--o{ community_members : "has"
    communities ||--o{ resources : "contains"
    communities ||--o{ announcements : "publishes"
    users ||--o{ announcements : "creates"
    
    users {
        uuid id PK
        string email
        string name
        string avatar_url
        timestamp created_at
    }
    
    communities {
        uuid id PK
        string name
        string description
        string location
        jsonb settings
        timestamp created_at
    }
    
    community_members {
        uuid id PK
        uuid user_id FK
        uuid community_id FK
        enum role
        timestamp joined_at
    }
    
    resources {
        uuid id PK
        uuid community_id FK
        string title
        string description
        string file_url
        enum type
        timestamp created_at
    }
    
    announcements {
        uuid id PK
        uuid community_id FK
        uuid author_id FK
        string title
        text content
        enum priority
        timestamp created_at
    }
```

## Security Architecture

```mermaid
graph TB
    subgraph Client Side
        U[User]
        B[Browser]
        SW[Service Worker]
    end
    
    subgraph Security Layers
        CSP[Content Security Policy]
        HTTPS[HTTPS Only]
        JWT[JWT Tokens]
        CSRF[CSRF Protection]
    end
    
    subgraph Supabase Security
        AUTH[Authentication]
        RLS[Row Level Security]
        RBAC[Role Based Access]
        VAL[Input Validation]
    end
    
    U --> B
    B --> CSP
    B --> HTTPS
    
    SW --> JWT
    SW --> CSRF
    
    JWT --> AUTH
    AUTH --> RLS
    RLS --> RBAC
    RBAC --> VAL
    
    style Security Layers fill:#ffe6e6
    style Supabase Security fill:#e6f0ff
```

## Deployment Architecture

```mermaid
graph LR
    subgraph Development
        DEV[Local Dev]
        GIT[Git Repository]
    end
    
    subgraph CI/CD
        GH[GitHub Actions]
        TEST[Tests]
        BUILD[Build]
    end
    
    subgraph Production
        subgraph Vercel
            EDGE[Edge Network]
            FN[Functions]
            STATIC[Static Assets]
        end
        
        subgraph Supabase
            DB[Database]
            AUTH[Auth Service]
            STORE[Storage]
        end
    end
    
    DEV --> GIT
    GIT --> GH
    GH --> TEST
    TEST --> BUILD
    BUILD --> EDGE
    
    EDGE --> FN
    EDGE --> STATIC
    FN --> DB
    FN --> AUTH
    FN --> STORE
```

## Performance Strategy

```mermaid
graph TD
    subgraph Initial Load
        IL1[Service Worker]
        IL2[Critical CSS]
        IL3[Preload Assets]
        IL4[Code Split]
    end
    
    subgraph Runtime
        RT1[Lazy Load]
        RT2[Virtual Scroll]
        RT3[Image Optimize]
        RT4[Debounce]
    end
    
    subgraph Caching
        C1[Static Assets - Forever]
        C2[API Data - 5 min]
        C3[Content - 1 hour]
        C4[User Data - Session]
    end
    
    IL1 --> RT1
    IL2 --> RT2
    IL3 --> RT3
    IL4 --> RT4
    
    RT1 --> C1
    RT2 --> C2
    RT3 --> C3
    RT4 --> C4