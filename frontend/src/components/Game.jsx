import { useState, useEffect } from "react";

const Game = ({ players, lobby }) => {
  const [seats, setSeats] = useState(Array(6).fill(null));
  const [error, setError] = useState("");

  useEffect(() => {
    if (players.length < 2 || players.length > 6) {
      setError("Need 2-6 players to start the game");
      return;
    }

    // Randomly assign seats to players
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    const newSeats = Array(6).fill(null);
    shuffledPlayers.forEach((player, index) => {
      newSeats[index] = player;
    });
    setSeats(newSeats);
  }, [players]);

  if (error) {
    return (
      <div className="text-red-500 text-center p-4 bg-red-500/20 rounded-lg border border-red-500/50">
        {error}
      </div>
    );
  }

  return (
    <div className="relative w-full max-h-[100dvh] flex items-center justify-center">
      {/* Rotation prompt for portrait mode */}
      <div className="md:hidden absolute inset-0 flex items-center justify-center bg-gray-900/90 z-50 portrait:flex landscape:hidden">
        <div className="text-center p-6">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-white animate-bounce"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <p className="text-white text-lg font-medium">
            Please rotate your device to landscape mode
          </p>
        </div>
      </div>

      {/* Game table */}
      <div className="relative w-full aspect-[16/9] max-w-7xl bg-green-800/90 rounded-xl border-4 border-gray-800 overflow-hidden portrait:hidden landscape:block">
        {/* Poker Table */}
        <div className="absolute inset-8 sm:inset-12 md:inset-16 bg-green-700/80 rounded-[100%] border-4 sm:border-6 md:border-8 border-gray-800">
          {/* Center pot area */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-900/30 p-2 sm:p-3 md:p-4 rounded-full">
            <span className="text-white text-sm sm:text-base md:text-lg font-bold whitespace-nowrap">
              Pot: $0
            </span>
          </div>
        </div>

        {/* Seat positions */}
        {seats.map((player, index) => {
          const positions = [
            "bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2", // Bottom center
            "bottom-1/4 left-2 sm:left-4", // Bottom left
            "top-1/3 left-2 sm:left-4", // Middle left
            "top-2 sm:top-4 left-1/2 -translate-x-1/2", // Top center
            "top-1/3 right-2 sm:right-4", // Middle right
            "bottom-1/4 right-2 sm:right-4", // Bottom right
          ];

          return (
            <div
              key={index}
              className={`absolute ${positions[index]} w-24 sm:w-32 md:w-40 h-14 sm:h-16 md:h-20 bg-gray-800/90 rounded-lg border border-gray-700 sm:border-2 p-1 sm:p-2 transform transition-all duration-300`}
            >
              {player ? (
                <div className="flex flex-col items-center justify-center h-full">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 rounded-full bg-gray-700 flex items-center justify-center mb-0.5">
                    <span className="text-xs sm:text-sm md:text-base font-bold text-white">
                      {player.username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white font-medium text-xs sm:text-sm truncate max-w-[90%]">
                    {player.username}
                  </span>
                  <span className="text-gray-400 text-[10px] sm:text-xs">
                    $1000
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-gray-500 text-xs">Empty Seat</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Game;
