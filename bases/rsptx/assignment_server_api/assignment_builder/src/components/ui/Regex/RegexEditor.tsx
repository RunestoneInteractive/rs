import { InputText } from "primereact/inputtext";
import React, { FC, useEffect, useState, useRef } from "react";

interface RegexEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const RegexEditor: FC<RegexEditorProps> = ({ value, onChange }) => {
  const [input, setInput] = useState(value || "");
  const [flags, setFlags] = useState("");
  const [testText, setTestText] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [isFlagsValid, setIsFlagsValid] = useState(true);
  const [showMatches, setShowMatches] = useState(false);
  const [matches, setMatches] = useState<string[]>([]);
  const [isMatch, setIsMatch] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    setInput(value || "");
  }, []);

  useEffect(() => {
    const validateWithoutChangingState = () => {
      try {
        if (!input.trim()) {
          setIsValid(true);
          setIsFlagsValid(true);
          return;
        }

        new RegExp(input, flags);
        setIsValid(true);
        setIsFlagsValid(true);
      } catch (e) {
        console.log(e);
        const error = e as Error;

        if (error.message.includes("Invalid flags")) {
          setIsFlagsValid(false);
          setIsValid(true);
        } else {
          setIsValid(false);
          setIsFlagsValid(true);
        }
      }
    };

    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    onChange(input);

    validateWithoutChangingState();
  }, [input]);

  const testRegex = () => {
    if (!input.trim() || !testText) {
      return;
    }

    try {
      const regex = new RegExp(input, flags);
      const matchResults = testText.match(regex) || [];

      setMatches(matchResults);
      setIsMatch(regex.test(testText));
      setShowMatches(true);
      setIsValid(true);
      setIsFlagsValid(true);
    } catch (e) {
      setShowMatches(false);
      const error = e as Error;

      if (error.message.includes("Invalid flags")) {
        setIsFlagsValid(false);
        setIsValid(true);
      } else {
        setIsValid(false);
        setIsFlagsValid(true);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleFlagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFlags(e.target.value);
  };

  const handleTestTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTestText(e.target.value);
  };

  const handleCloseMatches = () => {
    setShowMatches(false);
  };

  const renderMatchesPopup = () => {
    if (!showMatches) return null;

    return (
      <div
        className="p-2 border-round border-1 surface-border"
        style={{
          position: "absolute",
          zIndex: 100,
          backgroundColor: "white",
          boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
          width: "200px",
          right: 0,
          marginTop: "5px"
        }}
      >
        <div className="flex justify-content-between align-items-center mb-2">
          <span className="font-semibold">
            Result:
            <span
              className={isMatch ? "text-green-500" : "text-red-500"}
              style={{ marginLeft: "8px" }}
            >
              {isMatch ? "Match" : "No Match"}
            </span>
          </span>
          <button
            className="p-link"
            onClick={handleCloseMatches}
            style={{ background: "none", border: "none" }}
            aria-label="Close matches"
            tabIndex={0}
          >
            <i className="pi pi-times" />
          </button>
        </div>

        {isMatch && matches.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-1">Matches:</div>
            <ul className="m-0 p-0 pl-3" style={{ maxHeight: "100px", overflowY: "auto" }}>
              {matches.map((match, index) => (
                <li key={index} className="text-sm">
                  <code>{match}</code>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex gap-2 align-items-center w-full relative">
      <div className="flex-grow-1 p-inputgroup" style={{ width: "50%" }}>
        <span className="p-inputgroup-addon">
          <i
            className={isValid ? "pi pi-code" : "pi pi-exclamation-triangle"}
            style={{ color: isValid ? "inherit" : "#f59e0b" }}
          />
        </span>

        <InputText
          value={input}
          onChange={handleInputChange}
          className={`font-mono ${!isValid ? "p-invalid" : ""}`}
          placeholder="RegEx pattern"
        />
      </div>

      <div className="p-inputgroup flex-shrink-0" style={{ width: "15%" }}>
        <span className="p-inputgroup-addon">
          <i className="pi pi-flag" />
        </span>
        <InputText
          value={flags}
          onChange={handleFlagsChange}
          className={`font-mono ${!isFlagsValid ? "p-invalid" : ""}`}
          placeholder="Flags (e.g. i)"
        />
      </div>

      <div className="p-inputgroup flex-shrink-0" style={{ width: "30%" }}>
        <InputText value={testText} onChange={handleTestTextChange} placeholder="Test text..." />

        <button
          className="p-button p-button-success"
          onClick={testRegex}
          disabled={!input.trim() || !testText}
          type="button"
          aria-label="Test regex"
        >
          <i className="pi pi-play"></i>
        </button>
      </div>

      {renderMatchesPopup()}
    </div>
  );
};
