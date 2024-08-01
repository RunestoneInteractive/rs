/*
 * This file is part of Runestone Academy
 * This is javascript to support the pages and endpoints for assignment/instructor.py
 * Copyright (C) 2024 by Runestone Academy LTD
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 *
 */

let currentQuestionIndex = 0;
const questions = document.querySelectorAll(".question-row");
let questionsData = null;
let answersList = {};

function extractAnswerAndFeedback(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Querying the document for the element with the data-correct="yes" attribute
    let answerElement = doc.querySelector('li[data-correct="yes"]');
    let answerElementID = null;

    // Get the feedback element that immediately follows the correct answer
    let feedbackElement = null;
    if (answerElement) {
        feedbackElement = answerElement.nextElementSibling;
        while (feedbackElement && feedbackElement.getAttribute('data-component') !== 'feedback') {
            feedbackElement = feedbackElement.nextElementSibling;
        }
        answerElementID = answerElement.id;
    }

    let feedbackText = feedbackElement ? feedbackElement.textContent : null;
    // Return the elements, or null if not found
    return { answerElementID, feedbackText };
}

function renderQuestion(index) {
    const question = questionsData[index];
    const questionName = question.name;
    const radioButtons = document.querySelectorAll(`#${questionName}_form input[type="radio"]`);
    let { answerElementID, feedbackText } = extractAnswerAndFeedback(question.htmlsrc);
    if (answerElementID) {
        const correctOption = letterToNumber(answerElementID[answerElementID.length - 1]);
        // The runestone question component has the answers in the format: question_opt_1, question_opt_2, etc., but the htmlsrc has the answers in the format: question_opt_A, question_opt_B, etc.
        answerElementID = answerElementID.slice(0, -1) + correctOption.toString();
    }

    if (radioButtons.length === 0) {
        // Retry after a short delay if NodeList is empty (i.e., the question component hasn't been rendered yet)
        setTimeout(() => renderQuestion(index), 300);
    } else {
        answersList[questionName] = radioButtons;
        // Uncheck all radio buttons
        radioButtons.forEach(radio => radio.checked = false);
        // Disable all radio buttons
        radioButtons.forEach(radio => radio.disabled = true);

        // Check the correct radio button
        const correctRadioButton = document.getElementById(answerElementID);
        if (correctRadioButton) {
            correctRadioButton.checked = true;
            correctRadioButton.disabled = false;
        }

        renderFeedback(questionName, feedbackText);
    }
}

function renderFeedback(question, feedbackText) {
    const feedbackDiv = document.getElementById(`${question}_feedback`);
    feedbackDiv.className = "";
    feedbackDiv.classList.add("alert", "alert-info");
    if (feedbackText) {
        feedbackDiv.textContent = "✔️ " + feedbackText;
    }
    else {
        feedbackDiv.textContent = "No feedback available.";
    }
}

function showQuestion(index) {
    const prevButton = document.getElementById(`prev-btn-${index+1}`);
    const nextButton = document.getElementById(`next-btn-${index+1}`);

    renderQuestion(index);

    questions.forEach((question, i) => {
        question.style.display = i === index ? "block" : "none";
    });
    if (prevButton && nextButton) {
        if (currentQuestionIndex === 0) {
            prevButton.disabled = true;
        } else {
            prevButton.disabled = false;
        }

        if (currentQuestionIndex === questions.length - 1) {
            nextButton.disabled = true;
        } else {
            nextButton.disabled = false;
        }
    }
}

function showNextQuestion() {
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        showQuestion(currentQuestionIndex);
    }
}

function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        showQuestion(currentQuestionIndex);
    }
}

function numberToLetter(num) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return letters[num] || num;
}

function letterToNumber(letter) {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const index = letters.indexOf(letter.toUpperCase());
    return index !== -1 ? index : letter;
}

function generateChartData(counts, correctOption, choices) {
    const numChoices = choices.length;
    const totalVotes = Object.values(counts).reduce((a, b) => a + b, 0);
    const data = [];

    for (let i = 0; i < numChoices; i++) {
        const count = counts[i] || 0;
        const percentage = Math.round((count / totalVotes) * 100);
        data.push({
            option: numberToLetter(i),
            count,
            percentage,
            correct: i === correctOption
        });
    }

    return data;
}

function renderAltairChart(containerId, data, title) {
    const spec = {
        "data": {
            "values": data
        },
        "layer": [
            {
                "mark": { "type": "bar" },
                "encoding": {
                    "x": {
                        "field": "option",
                        "type": "ordinal",
                        "axis": { "labelAngle": 0 },
                        "title": "Choices"
                    },
                    "y": {
                        "field": "percentage",
                        "type": "quantitative",
                        "title": "Votes (%)",
                        "axis": { "tickMinStep": 1 }
                    },
                    "color": {
                        "field": "correct",
                        "type": "nominal",
                        "scale": {
                            "domain": [true, false],
                            "range": ["#14A44D", "#3B71CA"]
                        },
                        "legend": null
                    }
                }
            },
            {
                "mark": {
                    "type": "text",
                    "align": "center",
                    "baseline": "middle",
                    "dy": -5,
                    "color": "black"
                },
                "encoding": {
                    "x": {
                        "field": "option",
                        "type": "ordinal"
                    },
                    "y": {
                        "field": "percentage",
                        "type": "quantitative"
                    },
                    "text": {
                        "field": "percentage",
                        "type": "quantitative",
                        "format": "d"
                    }
                }
            }
        ],
        "title": title
    };

    vegaEmbed(`#${containerId}`, spec, { actions: false });
}

// Have to divide this code into functions
document.addEventListener("DOMContentLoaded", () => {
    questionsData = JSON.parse(document.getElementById("questions-data").textContent);

    questionsData.forEach((q, index) => {
        const questionIndex = index + 1;

        // Calculate the total votes for each voting stage
        const totalVote1 = Object.values(q.total_votes.vote_1.counts).reduce((a, b) => a + b, 0);
        const totalVote2 = Object.values(q.total_votes.vote_2.counts).reduce((a, b) => a + b, 0);

        let {answerElementID, feedbackText} = extractAnswerAndFeedback(q.htmlsrc);
        // Checking if the correct answer has been specified in the question
        if (answerElementID && totalVote1 > 0) {
            const correctOption = letterToNumber(answerElementID[answerElementID.length - 1]);

            // Need to use toString because the correct choice is a string
            const correctVote1 = q.total_votes.vote_1.counts[correctOption.toString()] || 0;
            const correctVote2 = q.total_votes.vote_2.counts[correctOption.toString()] || 0;

            // Calculate the percentage of correct votes in each voting stage
            const correctVote1Percentage = Math.round((correctVote1 / totalVote1) * 100);
            const correctVote2Percentage = Math.round((correctVote2 / totalVote2) * 100);

            // Dealing with the edge case where there are no votes for the second voting stage (i.e., NaN correctVote2Percentage)
            if (totalVote2 > 0) {
                // Calculate the learning gain
                const learningGain = correctVote2Percentage - correctVote1Percentage;
                const potentialImprovement = 100 - correctVote1Percentage;
                // Calculate the normalized change
                const normalizedChange = correctVote1Percentage === 100 ? "N/A" : Math.round((learningGain / potentialImprovement) * 100);

                // Update the normalized change card's text
                const normalizedChangeCard = document.getElementById(`normalized-change-card-${questionIndex}`);
                const normalizedChangePercentage = document.getElementById(`normalized-change-${questionIndex}`);
                if (normalizedChange !== "N/A") {
                    normalizedChangePercentage.textContent = normalizedChange + "%";
                    normalizedChangeCard.classList.add("bg-info");
                }
            }

            // Update the effectiveness card's text and color
            const effectivenessCard = document.getElementById(`effectiveness-card-${questionIndex}`);
            const effectivenessPercentage = document.getElementById(`effectiveness-percentage-${questionIndex}`);
            effectivenessPercentage.textContent = correctVote1Percentage + "%";
            if (correctVote1Percentage >= 30 && correctVote1Percentage <= 70) {
                effectivenessCard.classList.add("bg-success");
            } else {
                effectivenessCard.classList.add("bg-warning");
            }

            // Interval to ensure the answersList for the question is not empty
            const interval = setInterval(() => {
                if (answersList[q.name] && answersList[q.name].length > 0) {
                    clearInterval(interval);

                    const vote1Data = generateChartData(q.total_votes.vote_1.counts, correctOption, answersList[q.name]);
                    const vote2Data = generateChartData(q.total_votes.vote_2.counts, correctOption, answersList[q.name]);

                    renderAltairChart(`chart-vote1-${questionIndex}`, vote1Data, `Vote 1 Results (n=${totalVote1})`);
                    renderAltairChart(`chart-vote2-${questionIndex}`, vote2Data, `Vote 2 Results (n=${totalVote2})`);
                }
            }, 100);
        }
        else {
            // If the correct answer is not specified, don't render the charts
            const vote1ChartDiv = document.getElementById(`chart-vote1-${questionIndex}`);
            const vote2ChartDiv = document.getElementById(`chart-vote2-${questionIndex}`);
            vote1ChartDiv.textContent = "No data for vote 1.";
            vote2ChartDiv.textContent = "No data for vote 2.";
        }

        showQuestion(currentQuestionIndex);
    });
});