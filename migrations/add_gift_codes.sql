-- Gift Code System Migration
-- Add tables for gift code generation and activation

CREATE TABLE gift_code (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Code Properties
  code VARCHAR(32) UNIQUE NOT NULL,
  code_type VARCHAR(20) NOT NULL,
  
  -- Activation Details  
  duration_days INTEGER NOT NULL,
  
  -- Usage Tracking
  is_active BOOLEAN DEFAULT true,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  
  -- Monetization
  price_rub INTEGER,
  campaign_name VARCHAR(100),
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP,
  
  -- Single-use tracking
  activated_by UUID REFERENCES "User"(id),
  activated_at TIMESTAMP
);

CREATE TABLE gift_code_activation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  gift_code_id UUID NOT NULL REFERENCES gift_code(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "User"(id),
  
  activated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  subscription_id UUID REFERENCES "Subscription"(id),
  
  user_telegram_id VARCHAR(255),
  user_source VARCHAR(50)
);

-- Indexes
CREATE INDEX gift_code_code_idx ON gift_code(code);
CREATE INDEX gift_code_active_idx ON gift_code(is_active, expires_at);
CREATE INDEX gift_code_campaign_idx ON gift_code(campaign_name);

CREATE INDEX gift_activation_unique_idx ON gift_code_activation(gift_code_id, user_id);
CREATE INDEX gift_activation_code_idx ON gift_code_activation(gift_code_id);
CREATE INDEX gift_activation_user_idx ON gift_code_activation(user_id);
