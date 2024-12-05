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
    current_player_turn INT NOT NULL,
    current_round INT NOT NULL DEFAULT 1,  -- 1 or 2 for the two rounds
    round_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    button_position INT NOT NULL DEFAULT 1,
    pot_amount INT NOT NULL DEFAULT 0
);

-- Now create lobby table
CREATE TABLE lobbies (
    lobby_id INT AUTO_INCREMENT PRIMARY KEY,
    lobby_name VARCHAR(255) NOT NULL,
    lobby_password VARCHAR(255),
    expertise_level VARCHAR(50) NOT NULL,
    lobby_owner INT NOT NULL,
    user_ids TEXT,
    is_open BOOLEAN DEFAULT TRUE,
    locked BOOLEAN DEFAULT FALSE,
    starting_bank INT NOT NULL DEFAULT 1000,
    buy_in INT NOT NULL DEFAULT 100,
    game_started BOOLEAN DEFAULT FALSE,
    current_game_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lobby_owner) REFERENCES users(user_id),
    FOREIGN KEY (current_game_id) REFERENCES game_state(game_id)
);

-- Add foreign key to game_state after lobby is created
ALTER TABLE game_state
ADD FOREIGN KEY (lobby_id) REFERENCES lobbies(lobby_id) ON DELETE CASCADE;

-- Create game_players table
CREATE TABLE game_players (
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    seat_position INT NOT NULL,
    cards VARCHAR(255),                  -- Stored as comma-separated card IDs
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    stepped_back BOOLEAN NOT NULL DEFAULT FALSE,
    card_total INT,                      -- Running total of cards
    done_turn BOOLEAN NOT NULL DEFAULT FALSE,
    money INT NOT NULL DEFAULT 1000,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES game_state(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Create game_actions table
CREATE TABLE game_actions (
    action_id INT AUTO_INCREMENT PRIMARY KEY,
    game_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,    -- hit, step_back
    round INT NOT NULL DEFAULT 1,         -- 1 or 2
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES game_state(game_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Insert test users
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) 
VALUES 
('joe', 'joe@joe.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'admin', '5', '0', '0', 'default'),
('admin', 'admin@admin.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'admin', '5', '0', '0', 'default'),
('hi', 'hi@hi.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'host', '0', '0', '0', 'default'),
('yo', 'yo@yo.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'player', '0', '0', '0', 'default'),
('hey', 'hey@hey.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'player', '0', '0', '0', 'default');