import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { parse } from 'papaparse';


const Boardle = () => {
  const [currentGuess, setCurrentGuess] = useState('');
  const [guessNumber, setGuessNumber] = useState(1);
  const [message, setMessage] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const [guessHistory, setGuessHistory] = useState([]);
  const [gameOver, setGameOver] = useState(false);
  const [gamesDb, setGamesDb] = useState({});
  const [targetGame, setTargetGame] = useState(null);

  useEffect(() => {
    const fetchGamesData = async () => {
      console.log("Fetching games data")
      const response = await fetch('/games.csv');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const csvText = await response.text();
      const { data: gamesData } = parse(csvText, { header: true });

      const gamesDB = gamesData.reduce((acc, game) => {
        acc[game.name] = {
          year: game.year,
          weight: game.weight,
          rank: game.rank,
          maxPlayers: game.maxPlayers,
          playTime: game.playingtime,
        };
        return acc;
      }, {});

      const games = Object.entries(gamesDB);
      const [name, data] = games[Math.floor(Math.random() * games.length)];
      setTargetGame({ name, ...data });
      setGamesDb(gamesDB);
    };

    fetchGamesData();
  }, []);
  

  const fuzzyMatch = (str, pattern) => {
    str = str.toLowerCase();
    pattern = pattern.toLowerCase();
    
    let patternIdx = 0;
    let strIdx = 0;
    let matchIndexes = [];

    while (strIdx < str.length && patternIdx < pattern.length) {
      if (str[strIdx] === pattern[patternIdx]) {
        matchIndexes.push(strIdx);
        patternIdx++;
      }
      strIdx++;
    }

    return {
      isMatch: patternIdx === pattern.length,
      score: matchIndexes.length === 0 ? 0 : 
             (matchIndexes.length / str.length) * 
             (matchIndexes.length / pattern.length) *
             (1 / (matchIndexes[matchIndexes.length - 1] - matchIndexes[0] + 1))
    };
  };

  useEffect(() => {
    if (!currentGuess.trim()) {
      setSuggestions([]);
      return;
    }

    const matches = Object.keys(gamesDb)
      .map(game => ({
        name: game,
        ...fuzzyMatch(game, currentGuess)
      }))
      .filter(game => game.isMatch)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(game => game.name);

    setSuggestions(matches);
    setSelectedSuggestion(-1);
  }, [currentGuess]);

  if (Object.keys(gamesDb).length === 0) {
    return <div>Loading...</div>;
  }

  const compareYears = (guessYear, targetYear) => {
    if (guessYear === targetYear) return { match: true, message: '' };
    const diff = Math.abs(guessYear - targetYear);
    if (diff <= 5) {
      return {
        match: false,
        message: guessYear < targetYear ? '↑ Within 5 years' : '↓ Within 5 years'
      };
    }
    return {
      match: false,
      message: guessYear < targetYear ? '↑ Over 5 years newer' : '↓ Over 5 years older'
    };
  };

  const compareWeight = (guessWeight, targetWeight) => {
    if (Math.abs(guessWeight - targetWeight) < 0.3) return { match: true, message: '' };
    return {
      match: false,
      message: guessWeight < targetWeight ? '↑ More Complex' : '↓ Less Complex'
    };
  };

  const compareRank = (guessRank, targetRank) => {
    if (guessRank === targetRank) return { match: true, message: '' };
    if (Math.abs(guessRank - targetRank) <= 10) {
      return {
        match: false,
        message: guessRank < targetRank ? '↑ Ranked Lower' : '↓ Ranked Higher'
      };
    }
    return {
      match: false,
      message: guessRank < targetRank ? '↑ Much Lower' : '↓ Much Higher'
    };
  };

  const compareMaxPlayers = (guessPlayers, targetPlayers) => {
    if (guessPlayers === targetPlayers) return { match: true, message: '' };
    return {
      match: false,
      message: guessPlayers < targetPlayers ? '↑ More players' : '↓ Fewer players'
    };
  };

  const handleKeyDown = (e) => {
    if (gameOver) return;
    if (suggestions.length === 0) {
      if (e.key === 'Enter' && currentGuess) {
        handleGuess(currentGuess);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestion(prev => 
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestion(prev => prev > -1 ? prev - 1 : -1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedSuggestion >= 0) {
        handleGuess(suggestions[selectedSuggestion]);
      } else if (currentGuess) {
        handleGuess(currentGuess);
      }
    }
  };

  const handleGuess = (guess) => {
    if (gameOver) return;

    const gameEntry = Object.entries(gamesDb).find(
      ([name]) => name.toLowerCase() === guess.toLowerCase()
    );
    
    if (!gameEntry) {
      setMessage("Game not found in database");
      return;
    }

    const [gameName, guessedGame] = gameEntry;

    const yearComparison = compareYears(guessedGame.year, targetGame.year);
    const weightComparison = compareWeight(guessedGame.weight, targetGame.weight);
    const rankComparison = compareRank(guessedGame.rank, targetGame.rank);
    const playerComparison = compareMaxPlayers(guessedGame.maxPlayers, targetGame.maxPlayers);
    
    const newGuess = {
      name: gameName,
      year: {
        value: guessedGame.year,
        match: yearComparison.match,
        message: yearComparison.message
      },
      weight: {
        value: Number(guessedGame.weight).toFixed(1),
        match: weightComparison.match,
        message: weightComparison.message
      },
      rank: {
        value: Number(guessedGame.rank),
        match: rankComparison.match,
        message: rankComparison.message
      },
      maxPlayers: {
        value: Number(guessedGame.maxPlayers),
        match: playerComparison.match,
        message: playerComparison.message
      }
    };

    setGuessHistory(prev => [newGuess, ...prev]);
    setGuessNumber(prev => prev + 1);
    setCurrentGuess('');
    setSuggestions([]);

    if (gameName.toLowerCase() === targetGame.name.toLowerCase()) {
      setMessage("Congratulations! You've found the game!");
      setGameOver(true);
    } else if (guessNumber >= 5) {  // Check for game over before incrementing
      setMessage(`Game Over! The answer was ${targetGame.name}`);
      setGameOver(true);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-gray-900 text-white">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Boardle</h1>
        <p className="text-gray-400">Guess {guessNumber} of 6</p>
      </div>

      <div className="relative mb-6">
        <input
          type="text"
          value={currentGuess}
          onChange={(e) => setCurrentGuess(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a guess here..."
          disabled={gameOver}
          className="w-full p-3 pr-12 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={() => handleGuess(currentGuess)}
          disabled={gameOver}
          className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 text-gray-400 hover:text-white disabled:opacity-50"
        >
          <Search size={24} />
        </button>
        
        {suggestions.length > 0 && !gameOver && (
          <div className="absolute w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden z-10">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion}
                className={`p-2 cursor-pointer hover:bg-gray-700 ${
                  index === selectedSuggestion ? 'bg-gray-700' : ''
                }`}
                onClick={() => handleGuess(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {guessHistory.map((guess, index) => (
          <div key={index} className="p-4 rounded-lg bg-gray-800">
            <h3 className="text-xl font-bold mb-3">{guess.name}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className={`p-3 rounded ${guess.year.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="font-semibold">Year</div>
                <div>{guess.year.value} {guess.year.message}</div>
              </div>
              <div className={`p-3 rounded ${guess.weight.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="font-semibold">Weight</div>
                <div>{guess.weight.value} {guess.weight.message}</div>
              </div>
              <div className={`p-3 rounded ${guess.rank.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="font-semibold">Rank</div>
                <div>#{guess.rank.value} {guess.rank.message}</div>
              </div>
              <div className={`p-3 rounded ${guess.maxPlayers.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="font-semibold">Max Players</div>
                <div>{guess.maxPlayers.value} {guess.maxPlayers.message}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {message && (
        <div className="text-center text-xl font-bold mt-4">
          {message}
        </div>
      )}
    </div>
  );
};

export default Boardle;