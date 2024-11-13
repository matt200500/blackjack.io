-- Create users table
CREATE TABLE users (
    user_id INT(255) AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    wins INT(255) NOT NULL,
    losses INT(255) NOT NULL,
    games_played INT(255) NOT NULL,
    profile_picture VARCHAR(255)
);

-- Crate lobby table
CREATE TABLE lobby (
    lobby_id INT AUTO_INCREMENT PRIMARY KEY,
    lobby_name VARCHAR(255) NOT NULL,
    lobby_password VARCHAR(255),
    expertise_level VARCHAR(255) NOT NULL,
    is_open BOOLEAN NOT NULL DEFAULT TRUE,
    lobby_owner INT,
    user_ids JSON,
    pot INT(255) DEFAULT 0,
    big_blind INT(255),
    small_blind INT(255),
    FOREIGN KEY (lobby_owner) REFERENCES users(user_id) ON DELETE SET NULL
);

-- Create game table
CREATE TABLE game (
    user_id INT,
    lobby_id INT,
    card_1 INT(255),
    card_2 INT(255),
    money INT(255) DEFAULT 0,
    PRIMARY KEY (user_id, lobby_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (lobby_id) REFERENCES lobby(lobby_id) ON DELETE CASCADE
);

-- This is the hash of the password "abc123"
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) VALUES ('joe', 'joe@joe.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'admin', '0', '0', '0', 'default');
INSERT INTO users (username, email, password, role, wins, losses, games_played, profile_picture) VALUES ('hi', 'hi@hi.com', '$2b$10$nSQmUZ9ZYBpCAU5I5J2PQOOC/gufrv01wqUh9V0nqPB0WMRgnyMMC', 'host', '0', '0', '0', 'default');
