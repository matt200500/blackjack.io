const CARD_VALUES = {
  A: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  J: 10,
  Q: 10,
  K: 10,
};

const getRandomCard = () => {
  const cards = Object.keys(CARD_VALUES);
  return cards[Math.floor(Math.random() * cards.length)];
};

const getCardValue = (card) => {
  return CARD_VALUES[card];
};

const getInitialCards = () => {
  return [getRandomCard(), getRandomCard()];
};

module.exports = {
  getRandomCard,
  getCardValue,
  CARD_VALUES,
  getInitialCards,
};
