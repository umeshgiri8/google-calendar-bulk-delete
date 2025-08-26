(() => {
  // Function to get user input and confirmation
  const getUserInput = () => {
    const searchString = prompt("Enter the text/string to search for in calendar events that you want to delete:");
    
    if (!searchString || searchString.trim() === '') {
      alert("No search string provided. Operation cancelled.");
      return null;
    }
    
    const confirmation = confirm(
      `Are you sure you want to delete ALL events containing "${searchString.trim()}"?\n\n` +
      "This action cannot be undone. The script will:\n" +
      "1. Search through up to 12 pages of your calendar\n" +
      "2. Delete every event that contains this text\n" +
      "3. Continue until all matching events are removed\n\n" +
      "Click OK to proceed or Cancel to abort."
    );
    
    return confirmation ? searchString.trim() : null;
  };
  
  // Get user input first
  const searchString = getUserInput();
  if (!searchString) {
    console.log('Operation cancelled by user');
    return;
  }
  
  console.log(`Starting deletion process for events containing: "${searchString}"`);
  
  let currentPage = 1;
  const maxPages = 12;
  let totalDeleted = 0;
  
  const deleteMatchingEvents = () => {
    if (currentPage > maxPages) {
      console.log(`Finished processing all ${maxPages} pages. Total events deleted: ${totalDeleted}`);
      alert(`Deletion complete! Total events deleted: ${totalDeleted}`);
      return;
    }
    
    console.log(`Processing page ${currentPage}...`);
    
    // Find all spans that contain the search string
    const xpath = `//span[contains(text(), '${searchString}')]`;
    const matchingSpans = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    
    if (matchingSpans.snapshotLength > 0) {
      console.log(`Found ${matchingSpans.snapshotLength} matching events on page ${currentPage}`);
      
      // Click the first matching event
      const firstMatch = matchingSpans.snapshotItem(0);
      console.log(`Deleting event: ${firstMatch.textContent}`);
      firstMatch.click();
      
      setTimeout(() => {
        const deleteButton = document.querySelector('button[aria-label="Delete event"]') || document.querySelector('button[aria-label="Delete task"]');
        if (deleteButton) {
          deleteButton.click();
          
          // Check for recurring event dialog after clicking delete
          setTimeout(() => {
            const recurringDialog = document.querySelector('span.uW2Fw-k2Wrsb-fmcmS[jsname="MdSI6d"]');
            if (recurringDialog && recurringDialog.textContent.includes('Delete recurring event') || recurringDialog.textContent.includes('Delete repeating task')) {
              console.log('Recurring event dialog detected, clicking OK...');
              const okButton = document.querySelector('[data-mdc-dialog-action="ok"]');
              if (okButton) {
                okButton.click();
                totalDeleted++;
                console.log(`Recurring event deleted. Total deleted so far: ${totalDeleted}`);
                
                // Continue deleting after handling recurring event
                setTimeout(deleteMatchingEvents, 1000);
              } else {
                console.log('OK button not found in recurring event dialog, retrying...');
                setTimeout(deleteMatchingEvents, 500);
              }
            } else {
              // Regular event deletion
              totalDeleted++;
              console.log(`Event deleted. Total deleted so far: ${totalDeleted}`);
              
              // Continue deleting from the same page after a short delay
              setTimeout(deleteMatchingEvents, 800);
            }
          }, 500);
        } else {
          console.log('Delete button not found, retrying...');
          setTimeout(deleteMatchingEvents, 500);
        }
      }, 300);
    } else {
      console.log(`No more matching events found on page ${currentPage}`);
      
      // Move to next page
      if (currentPage < maxPages) {
        console.log(`Moving to page ${currentPage + 1}...`);
        const nextButton = document.querySelector('button[aria-label="Next month"]');
        
        if (nextButton) {
          nextButton.click();
          currentPage++;
          
          // Wait for page to load before continuing
          setTimeout(() => {
            console.log(`Now on page ${currentPage}, continuing search...`);
            deleteMatchingEvents();
          }, 2000);
        } else {
          console.log('Next month button not found, ending process');
          console.log(`Process completed. Total events deleted: ${totalDeleted}`);
          alert(`Deletion complete! Total events deleted: ${totalDeleted}`);
        }
      } else {
        console.log(`Reached maximum pages (${maxPages}). Total events deleted: ${totalDeleted}`);
        alert(`Deletion complete! Processed ${maxPages} pages. Total events deleted: ${totalDeleted}`);
      }
    }
  };
  
  // Start the deletion process
  deleteMatchingEvents();
})();
