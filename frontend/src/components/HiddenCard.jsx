const HiddenCard = () => {
  return (
    <div className="w-14 h-20 bg-gray-800 rounded-lg border-2 border-gray-700 flex items-center justify-center">
      <div className="w-10 h-16 bg-gray-700 rounded">
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-gray-600 text-2xl">?</span>
        </div>
      </div>
    </div>
  );
};

export default HiddenCard;
