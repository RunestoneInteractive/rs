export const generateShortAnswerPreview = (
  questionTitle: string,
  attachment: boolean,
  questionName: string
): string => {
  // Create a unique ID for the exercise
  const uniqueId = `sa_${questionName.replace(/[^a-zA-Z0-9]/g, "")}_${Math.floor(Math.random() * 10000)}`;

  // Generate HTML based on the provided examples
  return `
    <div class="runestone notAnswered">
      <div id="${uniqueId}" class="journal runestone-component-ready">
        <form id="${uniqueId}_journal" name="${uniqueId}_journal" action="">
          <fieldset>
            <div class="journal-question">
              ${questionTitle || "<p>No question provided</p>"}
            </div>
            
            <div id="${uniqueId}_journal_input">
              <div class="journal-options">
                <textarea 
                  id="${uniqueId}_solution" 
                  aria-label="textarea" 
                  placeholder="Write your answer here" 
                  class="form-control" 
                  rows="4" 
                  cols="50"
                ></textarea>
              </div>
            </div>
            
            <br>
            <div class="latexoutput"></div>
            <div>
              <button class="btn btn-success" type="button">Save</button>
            </div>
            
            <span>Instructor's Feedback</span>
            <div class="journal-options"></div>
            <div id="${uniqueId}_feedback" class="alert alert-danger">
              You have not answered this question yet.
            </div>
          </fieldset>
        </form>
        
        ${
          attachment
            ? `
        <div>
          <input type="file" id="${uniqueId}_fileme">
        </div>
        `
            : ""
        }
        
        <p class="runestone_caption">Activity: Short Answer ${attachment ? "with attachment" : ""} 
        <span class="runestone_caption_divid">(${uniqueId})</span></p>
      </div>
    </div>
  `;
};
