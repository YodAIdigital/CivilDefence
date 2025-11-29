# Civil Defence Expo - Project Brief

## Project Overview
Civil Defence Expo is a Progressive Web App (PWA) designed to provide critical civil defense information and community coordination capabilities. The app will serve as a central hub for emergency preparedness, risk information, and community-based response coordination.

## Core Requirements

### 1. Platform Requirements
- **Progressive Web App (PWA)** with offline-first architecture
- Works seamlessly on web browsers and mobile devices
- Service worker implementation for offline functionality
- Installable on devices with app-like experience

### 2. Authentication & User Management
- **Supabase** for authentication backend
- Community-based account system
- Users can create new communities or join existing ones
- Role-based access control (RBAC)

### 3. User Roles & Permissions
- **Public Users** (no login required)
  - Access to civil defense risk information
  - View general emergency preparedness content
  - Read public announcements
  
- **Community Members** (authenticated)
  - Join communities
  - View community-specific information
  - Participate in community discussions
  - Access community resources
  
- **Community Admins** (authenticated)
  - All Community Member permissions
  - Create and manage community
  - Manage member roles
  - Post community announcements
  - Upload community resources

### 4. Data Storage & Management
- **Supabase** for:
  - Real-time database
  - File storage for community resources
  - Row-level security for data access control
- Offline data caching strategy
- Sync mechanisms when connectivity restored

### 5. Design Requirements
- Clean, modern interface
- Custom branding capabilities
- ShadCN/MagicUI component integration
- Responsive design for all screen sizes
- Accessibility compliance (WCAG 2.1 AA)

### 6. Key Features
- **Public Information Section**
  - Civil defense risks by region
  - Emergency preparedness guides
  - Contact information for authorities
  - Public alerts and notifications
  
- **Community Features**
  - Community creation and management
  - Member directory
  - Resource sharing
  - Event coordination
  - Communication tools
  
- **Offline Capabilities**
  - Critical information available offline
  - Queue actions for sync when online
  - Local data persistence
  - Background sync

## Success Criteria
1. App functions reliably offline for core features
2. Seamless sync when connectivity restored
3. Intuitive community management
4. Fast page loads and smooth interactions
5. Secure role-based access implementation
6. Scalable architecture for growth

## Constraints
- Must work on devices with limited connectivity
- Should support older browsers (last 2 versions)
- Data privacy compliance required
- Performance on low-end devices
- Limited initial budget for infrastructure

## Target Audience
- General public seeking emergency information
- Community leaders coordinating local response
- Emergency management professionals
- Citizens preparing for civil defense scenarios