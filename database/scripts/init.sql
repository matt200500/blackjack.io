-- Create users table
CREATE TABLE users (
    user_id INT(255) AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    wins INT(255) NOT NULL,
    gamesPlayed INT(255) NOT NULL,
    profilePicture VARCHAR(255)
);

-- Crate lobby table
CREATE TABLE lobby (
    lobby_id INT AUTO_INCREMENT PRIMARY KEY,
    lobbyName VARCHAR(255) NOT NULL,
    LobbyPassword VARCHAR(255) NOT NULL,
    ExpertiseLevel VARCHAR(255) NOT NULL,
    IsOpen BOOLEAN NOT NULL DEFAULT TRUE,
    LobbyOwner INT,
    user_ids JSON,
    pot INT(255) DEFAULT 0,
    big_blind INT(255),
    small_blind INT(255),
    FOREIGN KEY (LobbyOwner) REFERENCES users(user_id) ON DELETE SET NULL
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


INSERT INTO users (username, password, wins, gamesPlayed) VALUES ('joe', 'password', '0', '0');
