-- Create users table
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    wins INT NOT NULL DEFAULT 0,
    losses INT NOT NULL DEFAULT 0,
    games_played INT NOT NULL DEFAULT 0,
    total_earnings DECIMAL(10,2) NOT NULL DEFAULT 0,
    profile_picture VARCHAR(255)
);

-- Create lobby table
CREATE TABLE lobby (
    lobby_id INT AUTO_INCREMENT PRIMARY KEY,
    lobby_name VARCHAR(255) NOT NULL,
    lobby_password VARCHAR(255),
    expertise_level VARCHAR(255) NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    lobby_owner INT,
    user_ids VARCHAR(255),
    min_buy_in DECIMAL(10,2) NOT NULL DEFAULT 100.00,
    max_buy_in DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
    small_blind DECIMAL(10,2) NOT NULL DEFAULT 1.00,
    big_blind DECIMAL(10,2) NOT NULL DEFAULT 2.00,
    current_game_id INT,
    FOREIGN KEY (lobby_owner) REFERENCES users(user_id) ON DELETE SET NULL
);

-- First, drop the existing game table if it exists
DROP TABLE IF EXISTS game;

-- Create the new game table with poker-specific columns
CREATE TABLE game (
    game_id INT AUTO_INCREMENT,
    lobby_id INT,
    user_id INT,
    money INT DEFAULT 1000,
    pot INT DEFAULT 0,
    big_blind INT DEFAULT 0,
    small_blind INT DEFAULT 0,
    cards VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    is_folded BOOLEAN DEFAULT FALSE,
    current_bet INT DEFAULT 0,
    seat_position INT,
    PRIMARY KEY (game_id, user_id, lobby_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (lobby_id) REFERENCES lobby(lobby_id) ON DELETE CASCADE
);

-- Create a new table for tracking game state
CREATE TABLE game_state (
    game_id INT PRIMARY KEY AUTO_INCREMENT,
    lobby_id INT,
    current_round VARCHAR(50) DEFAULT 'preflop',
    community_cards VARCHAR(255),
    current_player_turn INT,
    dealer_position INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lobby_id) REFERENCES lobby(lobby_id) ON DELETE CASCADE,
    FOREIGN KEY (current_player_turn) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create game_players table
CREATE TABLE game_players (
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    seat_position INT NOT NULL,
    stack_amount DECIMAL(10,2) NOT NULL,
    current_bet DECIMAL(10,2) NOT NULL DEFAULT 0,
    folded BOOLEAN NOT NULL DEFAULT FALSE,
    cards VARCHAR(255), -- Stored as comma-separated card IDs
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES game(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create game_actions table
CREATE TABLE game_actions (
    action_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- fold, check, call, raise, all-in
    amount DECIMAL(10,2),
    round VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES game(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create game_rounds table
CREATE TABLE game_rounds (
    round_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    round_type VARCHAR(50) NOT NULL, -- preflop, flop, turn, river
    pot_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES game(game_id) ON DELETE CASCADE
);

-- This is the hash of the password "abc123"
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) VALUES ('joe', 'joe@joe.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'admin', '5', '0', '0', 'default');
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) VALUES ('hi', 'hi@hi.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'host', '0', '0', '0', 'default');
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) VALUES ('yo', 'yo@yo.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'player', '0', '0', '0', 'default');
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) VALUES ('hey', 'hey@hey.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'player', '0', '0', '0', 'default');