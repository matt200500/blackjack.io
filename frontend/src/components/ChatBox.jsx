import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faLock } from "@fortawesome/free-solid-svg-icons";

const ChatBox = ({ user, lobbyId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const socketRef = useRef();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    socketRef.current = io("http://localhost:3001");

    socketRef.current.emit("join lobby", lobbyId);

    socketRef.current.on("chat message", (msg) => {
      setMessages((prevMessages) => [...prevMessages, msg]);
    });

    return () => {
      socketRef.current.emit("leave lobby", lobbyId);
      socketRef.current.disconnect();
    };
  }, [lobbyId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim() && user) {
      const messageData = {
        user: user.username,
        text: inputMessage.trim(),
        lobbyId: lobbyId,
        profilePicture: user.profilePicture,
      };
      socketRef.current.emit("chat message", messageData);
      setInputMessage("");
    }
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg w-full max-w-2xl h-[400px] md:h-[600px] flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-white flex items-center">
        <span className="flex-grow">Chat</span>
        {user && (
          <span className="text-sm font-medium text-blue-300">
            {user.username}
          </span>
        )}
      </h2>

      <div className="flex-grow overflow-y-auto mb-4 bg-gray-700 p-3 rounded text-white scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-700">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`mb-3 p-2 rounded-lg ${
              user && msg.user === user.username
                ? "bg-blue-600 ml-auto max-w-[80%]"
                : "bg-gray-600 mr-auto max-w-[80%]"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <img
                src={`/pfps/${msg.profilePicture || "default"}.png`}
                alt={msg.user}
                className="w-6 h-6 rounded-full border border-gray-500"
              />
              <div className="text-sm font-bold text-blue-200">{msg.user}</div>
            </div>
            <div className="text-gray-100 break-words leading-relaxed">
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {user ? (
        <form onSubmit={sendMessage} className="flex gap-2 max-w-full">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="flex-grow p-2 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            placeholder="Type a message..."
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center whitespace-nowrap"
          >
            <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
            Send
          </button>
        </form>
      ) : (
        <div className="bg-gray-700 text-yellow-500 p-4 rounded flex items-center justify-center">
          <FontAwesomeIcon icon={faLock} className="mr-2" />
          You must be logged in to chat
        </div>
      )}
    </div>
  );
};

export default ChatBox;
