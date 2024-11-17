DROP TABLE IF EXISTS lobby;
DROP TABLE IF EXISTS game_rounds;
DROP TABLE IF EXISTS game_players;
DROP TABLE IF EXISTS game_actions;
DROP TABLE IF EXISTS game_state;
DROP TABLE IF EXISTS game;
DROP TABLE IF EXISTS users;

-- Create users table first
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    games_played INT NOT NULL DEFAULT 0,
    total_earnings INT NOT NULL DEFAULT 0,
    profile_picture VARCHAR(255)
);

-- Create game_state table before lobby
CREATE TABLE game_state (
    game_id INT AUTO_INCREMENT PRIMARY KEY,
    lobby_id INT NOT NULL,
    button_position INT NOT NULL,
    current_player_turn INT NOT NULL,
    current_round VARCHAR(50) NOT NULL,  -- preflop, flop, turn, river
    community_cards VARCHAR(255),        -- Stored as comma-separated card IDs
    pot INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Now create lobby table
CREATE TABLE lobby (
    lobby_id INT AUTO_INCREMENT PRIMARY KEY,
    lobby_name VARCHAR(255) NOT NULL,
    lobby_password VARCHAR(255),
    expertise_level VARCHAR(50) NOT NULL,
    lobby_owner INT NOT NULL,
    user_ids TEXT,
    is_open BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE,
    big_blind INT NOT NULL DEFAULT 10,
    small_blind INT NOT NULL DEFAULT 5,
    starting_bank INT NOT NULL DEFAULT 1000,
    game_started BOOLEAN DEFAULT FALSE,
    current_game_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lobby_owner) REFERENCES users(user_id),
    FOREIGN KEY (current_game_id) REFERENCES game_state(game_id)
);

-- Add foreign key to game_state after lobby is created
ALTER TABLE game_state
ADD FOREIGN KEY (lobby_id) REFERENCES lobby(lobby_id) ON DELETE CASCADE;

-- Create game_players table
CREATE TABLE game_players (
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    seat_position INT NOT NULL,
    money_amount INT NOT NULL,
    stack_amount INT NOT NULL,
    current_bet INT NOT NULL DEFAULT 0,
    folded BOOLEAN NOT NULL DEFAULT FALSE,
    cards VARCHAR(255),                  -- Stored as comma-separated card IDs
    is_small_blind BOOLEAN NOT NULL DEFAULT FALSE,
    is_big_blind BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES game_state(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create game_actions table
CREATE TABLE game_actions (
    action_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,    -- fold, check, call, raise, all-in
    amount INT,
    round VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES game_state(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Insert test users
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) 
VALUES 
('joe', 'joe@joe.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'admin', '5', '0', '0', 'default'),
('hi', 'hi@hi.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'host', '0', '0', '0', 'default'),
('yo', 'yo@yo.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'player', '0', '0', '0', 'default'),
('hey', 'hey@hey.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'player', '0', '0', '0', 'default');