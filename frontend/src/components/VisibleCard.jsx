const VisibleCard = ({ card }) => {
  // console.log(card);
  return (
    <div className="w-14 h-20 bg-white rounded-lg border-2 border-gray-300 flex items-center justify-center">
      <span className="text-2xl font-bold text-gray-900">{card}</span>
    </div>
  );
};

export default VisibleCard;
