-- AxelleVault Cybersecurity Platform Schema
-- 
-- 1. New Tables
--    - user_profiles: Extended user profile information
--    - security_logs: Comprehensive security event logging
--    - login_attempts: Track login attempts for intrusion detection
--    - security_scores_history: Historical security score tracking
--    - blocked_ips: Temporarily or permanently blocked IP addresses
--
-- 2. Security
--    - Enable RLS on all tables
--    - Users can only read their own data
--    - Service role for intrusion detection writes

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  created_at timestamptz DEFAULT now(),
  last_login timestamptz DEFAULT now(),
  security_score integer DEFAULT 50 CHECK (security_score >= 0 AND security_score <= 100),
  total_logins integer DEFAULT 0,
  failed_login_count integer DEFAULT 0
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Security Logs Table
CREATE TABLE IF NOT EXISTS security_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_data jsonb DEFAULT '{}'::jsonb,
  risk_level text DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own security logs"
  ON security_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security logs"
  ON security_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Login Attempts Table
CREATE TABLE IF NOT EXISTS login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text,
  success boolean DEFAULT false,
  attempt_time timestamptz DEFAULT now(),
  user_agent text,
  blocked boolean DEFAULT false
);

ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage login attempts"
  ON login_attempts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Security Scores History Table
CREATE TABLE IF NOT EXISTS security_scores_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer CHECK (score >= 0 AND score <= 100),
  factors jsonb DEFAULT '{}'::jsonb,
  calculated_at timestamptz DEFAULT now()
);

ALTER TABLE security_scores_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own security score history"
  ON security_scores_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security score history"
  ON security_scores_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Blocked IPs Table
CREATE TABLE IF NOT EXISTS blocked_ips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  reason text DEFAULT '',
  blocked_at timestamptz DEFAULT now(),
  blocked_until timestamptz,
  auto_blocked boolean DEFAULT false
);

ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage blocked IPs"
  ON blocked_ips FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Tool Usage History Table
CREATE TABLE IF NOT EXISTS tool_usage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  input_data text,
  result text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tool_usage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own tool usage history"
  ON tool_usage_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tool usage history"
  ON tool_usage_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Encrypted Notes Table
CREATE TABLE IF NOT EXISTS encrypted_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  encrypted_content text NOT NULL,
  iv text NOT NULL,
  salt text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE encrypted_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own encrypted notes"
  ON encrypted_notes FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Vault PIN Hash Table
CREATE TABLE IF NOT EXISTS vault_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE vault_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vault PIN"
  ON vault_pins FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'free' CHECK (role IN ('free', 'premium', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert/update roles"
  ON user_roles FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure each user has only one role record
CREATE POLICY "User can maintain only one role row"
  ON user_roles FOR INSERT, UPDATE
  TO authenticated
  WITH CHECK (auth.uid() = user_id); 

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON security_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_created_at ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON login_attempts(attempt_time DESC);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_address ON blocked_ips(ip_address);