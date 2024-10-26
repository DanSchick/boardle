import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { parse } from 'papaparse';


const MechanicsHintCard = ({ matchingMechanics }) => {
  if (!matchingMechanics || matchingMechanics.length === 0) {
    return (
      <div className="col-span-3 p-2 rounded bg-gray-800">
        <div className="text-sm">
          <div className="font-semibold">Mechanics</div>
          <div>No matching mechanics</div>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-3 p-2 rounded bg-green-600 text-center">
      <div className="text-sm">
        <div className="font-semibold">Shared Mechanics</div>
        <div className="flex flex-wrap gap-1 mt-1 justify-center">
          {matchingMechanics.map((mechanic, index) => (
            <div 
              key={index} 
              variant="secondary"
              className="px-2 py-1 rounded bg-green-700 text-white text-xs inline-block"
            >
              {mechanic}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


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
  const [matchingMechanics, setMatchingMechanics] = useState(null)
  
  
  const getDateSeed = () => {
    const now = new Date();
    // Create dates using UTC to avoid timezone issues
    const startDate = Date.UTC(2024, 10, 25); // UTC midnight Jan 1, 2024
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const daysSinceStart = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
    
    
    return daysSinceStart;
  };

  useEffect(() => {
    const fetchGamesData = async () => {
      console.log("Fetching games data")
      const response = await fetch('/games_with_mechanics.csv');
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
          category: game.category,
          imageUrl: game.imagePath,
          mechanics: game.mechanics
        };
        return acc;
      }, {});

      const games = Object.entries(gamesDB);
      const sortedGames = games.sort(([, a], [, b]) => a.rank - b.rank);
      const dayIndex = Math.abs(getDateSeed()) % sortedGames.length;
      console.log("Using index:", dayIndex, "out of", sortedGames.length);

      const [name, data] = sortedGames[dayIndex];
      setTargetGame({ name, ...data });
      setGamesDb(gamesDB);
    };

    fetchGamesData();
  }, []);

  const getMatchingMechanics = (guessName) => {
    const guessGame = gamesDb[guessName];
    if (!guessGame?.mechanics || !targetGame?.mechanics) return [];
    
    const guessMechanics = guessGame.mechanics.split('|');
    const targetMechanics = targetGame.mechanics.split('|');
    
    return guessMechanics.filter(mechanic => 
      targetMechanics.includes(mechanic)
    );
  };

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
        message: guessYear < targetYear ? '↑' : '↓'
      };
    }
    return {
      match: false,
      message: guessYear < targetYear ? '↑↑' : '↓↓'
    };
  };

  const compareWeight = (guessWeight, targetWeight) => {
    if (Math.abs(guessWeight - targetWeight) < 0.3) return { match: true, message: '' };
    return {
      match: false,
      message: guessWeight < targetWeight ? '↑' : '↓'
    };
  };

  const compareRank = (guessRank, targetRank) => {
    if (guessRank === targetRank) return { match: true, message: '' };
    const diff = targetRank - guessRank;
    if (Math.abs(diff) <= 10) {
      return {
        match: false,
        message: diff > 0 ? '↓' : '↑' 
      };
    }
    return {
      match: false,
      message: diff > 0 ? '↓↓' : '↑↑' 
    };
  };
  const compareMaxPlayers = (guessPlayers, targetPlayers) => {
    if (guessPlayers === targetPlayers) return { match: true, message: '' };
    return {
      match: false,
      message: guessPlayers < targetPlayers ? '↑' : '↓'
    };
  };

  const comparePlayTime = (guessTime, targetTime) => {
    if (guessTime === targetTime) return { match: true, message: '' };
    const diff = targetTime - guessTime;  // Remove Math.abs() to preserve direction
    if (Math.abs(diff) <= 15) {  // Use Math.abs() only for threshold check
      return {
        match: false,
        message: diff > 0 ? '↑' : '↓'  // If target is bigger, show up arrow
      };
    }
    return {
      match: false,
      message: diff > 0 ? '↑↑' : '↓↓'  // If target is bigger, show double up arrow
    };
  };

  const compareCategory = (guessCategory, targetCategory) => {
    if (guessCategory.toLowerCase() === targetCategory.toLowerCase()) {
      return { match: true, message: '' };
    }
    return { match: false, message: '' };
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

    const mechanics = getMatchingMechanics(gameName);
    setMatchingMechanics(mechanics);

    const yearComparison = compareYears(guessedGame.year, targetGame.year);
    const weightComparison = compareWeight(guessedGame.weight, targetGame.weight);
    const rankComparison = compareRank(guessedGame.rank, targetGame.rank);
    const playerComparison = compareMaxPlayers(guessedGame.maxPlayers, targetGame.maxPlayers);
    const playTimeComparison = comparePlayTime(guessedGame.playTime, targetGame.playTime);
    const categoryComparison = compareCategory(guessedGame.category, targetGame.category);
    
    const newGuess = {
      name: gameName,
      mechanics: mechanics,
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
      },
      playTime: {
        value: Number(guessedGame.playTime),
        match: playTimeComparison.match,
        message: playTimeComparison.message
      },
      category: {
        value: guessedGame.category,
        match: categoryComparison.match,
        message: categoryComparison.message
      }
    };

    setGuessHistory(prev => [newGuess, ...prev]);
    setGuessNumber(prev => prev + 1);
    setCurrentGuess('');
    setSuggestions([]);

    if (gameName.toLowerCase() === targetGame.name.toLowerCase()) {
      setMessage("Congratulations! You've found the game!");
      setGameOver(true);
    } else if (guessNumber >= 5) {
      setMessage(`Game Over! The answer was ${targetGame.name}`);
      setGameOver(true);
    }
  };

  const generateShareText = (guessHistory, targetGame, won) => {
    const totalGuesses = guessHistory.length;
    const emojiMap = {
      match: '🟩',
      close: '🟨',
      wrong: '⬛'
    };
    
    const guessEmojis = guessHistory.map(guess => {
      return [
        guess.year.match ? '🟩' : '🟨',
        guess.weight.match ? '🟩' : '🟨',
        guess.rank.match ? '🟩' : '🟨',
        guess.maxPlayers.match ? '🟩' : '🟨',
        guess.playTime.match ? '🟩' : '🟨',
        guess.category.match ? '🟩' : '🟨'
      ].join('');
    });
  
    const header = `Boardle - ${won ? totalGuesses : 'X'}/6\n\n`;
    const guessLines = guessEmojis.join('\n');
    
    return header + guessLines;
  };
  
  // Add this function to handle sharing
  const handleShare = () => {
    const shareText = generateShareText(guessHistory, targetGame, guessHistory.some(guess => 
      guess.name.toLowerCase() === targetGame.name.toLowerCase()
    ));
    
    if (navigator.share) {
      navigator.share({
        text: shareText
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareText)
        .then(() => setMessage("Results copied to clipboard!"))
        .catch(() => setMessage("Failed to copy results"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
    <div className="w-full max-w-2xl mx-auto p-6 bg-gray-900 text-white">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Boardle</h1>
        <p className="text-gray-400">Guess {guessNumber} of 6</p>
      </div>
      {message && (
        <div className="text-center text-xl font-bold mt-4">
          {message}
        </div>
      )}
      {gameOver && (
        <>
        <div className="text-center mb-4">
            <img src={targetGame.imageUrl} alt={targetGame.name} className="w-full h-auto" />
        </div>
        <div className="text-center mt-4 mb-4">
          <button
            onClick={handleShare}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold"
          >
            Share Results
          </button>
        </div>
        </>
      )}

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

      <div className="space-y-2">
        {guessHistory.map((guess, index) => (
          <div key={index} className="p-2 rounded-lg bg-gray-800">
            <h3 className="text-lg font-bold mb-2">{guess.name}</h3>
            <div className="grid grid-cols-3 gap-2">
              <div className={`p-2 rounded ${guess.year.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="text-sm font-semibold">Year</div>
                <div className="text-sm">{guess.year.value} {guess.year.message}</div>
              </div>
              <div className={`p-2 rounded ${guess.weight.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="text-sm font-semibold">Weight</div>
                <div className="text-sm">{guess.weight.value} {guess.weight.message}</div>
              </div>
              <div className={`p-2 rounded ${guess.rank.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="text-sm font-semibold">Rank</div>
                <div className="text-sm">#{guess.rank.value} {guess.rank.message}</div>
              </div>
              <div className={`p-2 rounded ${guess.maxPlayers.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="text-sm font-semibold">Max Players</div>
                <div className="text-sm">{guess.maxPlayers.value} {guess.maxPlayers.message}</div>
              </div>
              <div className={`p-2 rounded ${guess.playTime.match ? 'bg-green-600' : 'bg-yellow-500'}`}>
                <div className="text-sm font-semibold">Play Time</div>
                <div className="text-sm">{guess.playTime.value} min {guess.playTime.message}</div>
              </div>
              <div className={`p-2 rounded ${guess.category.match ? 'bg-green-600' : 'bg-gray-500'}`}>
                <div className="text-sm font-semibold">Category</div>
                <div className="text-sm">{guess.category.value} {guess.category.message}</div>
              </div>
              <MechanicsHintCard matchingMechanics={guess.mechanics} />
            </div>
          </div>
        ))}
      </div>

    </div>
    </div>
  );
};

export default Boardle;