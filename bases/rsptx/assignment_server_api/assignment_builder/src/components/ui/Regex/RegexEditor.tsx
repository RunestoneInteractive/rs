import { Icon } from "@components/ui/Icon";
import { ActionIcon, Text, TextInput } from "@mantine/core";
import React, { FC, useEffect, useState, useRef } from "react";

import styles from "./RegexEditor.module.css";

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
      <div className={styles.popup}>
        <div className={styles.popupHeader}>
          <Text span fw="bold">
            Result:
            <Text span className={isMatch ? styles.matchPositive : styles.matchNegative}>
              <span className={styles.matchLabel}>{isMatch ? "Match" : "No Match"}</span>
            </Text>
          </Text>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={handleCloseMatches}
            aria-label="Close matches"
          >
            <Icon name="times" />
          </ActionIcon>
        </div>

        {isMatch && matches.length > 0 && (
          <div>
            <div className={styles.matchesTitle}>Matches:</div>
            <ul className={styles.matchesList}>
              {matches.map((match, index) => (
                <li key={index}>
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
    <div className={styles.editor}>
      <TextInput
        className={styles.pattern}
        classNames={{ input: styles.mono }}
        value={input}
        onChange={handleInputChange}
        placeholder="Regex pattern"
        aria-label="Regex pattern"
        error={!isValid}
        leftSection={
          <Icon
            name={isValid ? "code" : "exclamation-triangle"}
            color={isValid ? undefined : "var(--rs-warning)"}
          />
        }
      />

      <TextInput
        className={styles.flags}
        classNames={{ input: styles.mono }}
        value={flags}
        onChange={handleFlagsChange}
        placeholder="Flags (e.g. i)"
        error={!isFlagsValid}
        leftSection={<Icon name="flag" />}
      />

      <div className={styles.test}>
        <TextInput
          className={styles.testInput}
          value={testText}
          onChange={handleTestTextChange}
          placeholder="Test text…"
        />
        <ActionIcon
          color="green"
          onClick={testRegex}
          disabled={!input.trim() || !testText}
          aria-label="Test regex"
        >
          <Icon name="play" />
        </ActionIcon>
      </div>

      {renderMatchesPopup()}
    </div>
  );
};
