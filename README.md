# Blackjack.io
Blackjack.io is a modern take on the classic card game, designed to bring players together in a seamless online experience. In an age where physical distance often separates us, Blackjack.io provides an engaging and accessible platform for friends and enthusiasts to enjoy a timeless game from anywhere. \
With sleek design, intuitive gameplay, and multiplayer functionality, our product bridges traditional gaming with contemporary technology, creating a dynamic and inclusive gaming environment.

https://github.com/user-attachments/assets/e3392817-9e0c-4ec4-b354-97f07423cdca

## User Guide
Expected to be installed:
```
docker
Node.js
```

First git clone the repository at https://github.com/matt200500/blackjack.io.git

```
$ git clone https://github.com/matt200500/blackjack.io.git
```

Second, open docker desktop

Third, to run do the following:
```
docker-compose up --build
```
To close the application first cancel the program by doing cntr+c followed by the following:
```
docker-compose down
```
We had a few issues developing this web application which are below:

Sometimes the program may have the game be missaligned from the lobby id itself, to fix you simply need to stop and start the program again.
Some functionality such as cross device functionality have not been implemented due to the sql database requiring devices to have login permissions.
Sometimes with larger parties, the turn controls for the users are scrambled.

Apologies for these issues being present. We could not fix them in time.


