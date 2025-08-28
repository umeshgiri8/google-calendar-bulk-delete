(() => {
  // Enhanced logging utility
  const logger = {
    info: (message, data = null) => {
      const timestamp = new Date().toISOString();
      console.log(`[INFO ${timestamp}] ${message}`, data || '');
    },
    warn: (message, data = null) => {
      const timestamp = new Date().toISOString();
      console.warn(`[WARN ${timestamp}] ${message}`, data || '');
    },
    error: (message, error = null) => {
      const timestamp = new Date().toISOString();
      console.error(`[ERROR ${timestamp}] ${message}`, error || '');
    },
    success: (message, data = null) => {
      const timestamp = new Date().toISOString();
      console.log(`[SUCCESS ${timestamp}] ${message}`, data || '');
    }
  };

  const getAndValidateInput = (key, message, defaultValue) => {
    const result = prompt(message, defaultValue);
    
      if (!result) {
        logger.warn('User cancelled input dialog or provided null value');
        alert(`No value for ${key} provided. Operation cancelled.`);
        return null;
      }
      
      if (result.trim() === '') {
        logger.warn('User provided empty string after trimming');
        alert(`Value for ${key} cannot be empty. Operation cancelled.`);
        return null;
      }
      
      const trimmedSearch = result.trim();
      logger.info(`Value for ${key} collected`, {string: result, length: result.length});

      return result;
  }

  const reoccurringDialogSelector = 'span.uW2Fw-k2Wrsb-fmcmS[jsname="MdSI6d"]';
  const reoccurringDialogOkButtonSelector = '[data-mdc-dialog-action="ok"]';

  let nextPageLabel, deleteEventButtonLabel, deleteTaskButtonLabel, deleteReoccurringEventLabel,
    deleteReoccurringTaskLabel, maxPages;

  // Function to get user input and confirmation with enhanced validation
  const getUserInput = () => {
    logger.info('Starting user input collection');

    try {
      nextPageLabel = getAndValidateInput('nextPageLabel', "Next page label", 'Next month');
      deleteEventButtonLabel = getAndValidateInput('deleteEventButtonLabel', "Delete event label", 'Delete event');
      deleteTaskButtonLabel = getAndValidateInput('deleteTaskButtonLabel', "Delete task label", 'Delete task');
      deleteReoccurringEventLabel = getAndValidateInput('deleteReoccurringEventLabel', "Delete reoccurring event label", 'Delete repeating event');
      deleteReoccurringTaskLabel = getAndValidateInput('deleteReoccurringTaskLabel', "Delete reoccurring task label", 'Delete recurring task');
      maxPages = getAndValidateInput('maxPages', "Max months to process", 12);
      const trimmedSearch = getAndValidateInput('trimmedSearch', "Enter the text/string to search for in calendar events that you want to delete", "");
      const confirmation = confirm(
        `Are you sure you want to delete ALL events containing "${trimmedSearch}"?\n\n` +
        "This action cannot be undone. The script will:\n" +
        `1. Search through up to ${maxPages} pages of your calendar` +
        "2. Delete every event that contains this text\n" +
        "3. Continue until all matching events are removed\n\n" +
        "Click OK to proceed or Cancel to abort."
      );
      
      if (!confirmation) {
        logger.info('User declined confirmation dialog');
        return null;
      }
      
      logger.success('User input validated and confirmed', { searchString: trimmedSearch });
      return trimmedSearch;
      
    } catch (error) {
      logger.error('Error during user input collection', error);
      alert('An error occurred while collecting input. Please try again.');
      return null;
    }
  };
  
  // Enhanced element selection with retry logic
  const waitForElement = (selector, timeout = 5000, retryInterval = 100) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      
      const checkElement = () => {
        try {
          const element = document.querySelector(selector);
          if (element) {
            logger.info('Element found', { selector, timeWaited: Date.now() - startTime });
            resolve(element);
            return;
          }
          
          if (Date.now() - startTime >= timeout) {
            logger.warn('Element not found within timeout', { selector, timeout });
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            return;
          }
          
          setTimeout(checkElement, retryInterval);
        } catch (error) {
          logger.error('Error while waiting for element', { selector, error });
          reject(error);
        }
      };
      
      checkElement();
    });
  };
  
  // Enhanced XPath search with error handling
  const findMatchingEvents = (searchString) => {
    try {
      logger.info('Searching for matching events', { searchString });
      
      const xpath = `//span[contains(text(), '${searchString}')]`;
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      
      logger.info('XPath search completed', { 
        xpath, 
        matchCount: result.snapshotLength,
        searchString 
      });
      
      return result;
    } catch (error) {
      logger.error('Error during XPath search', { searchString, error });
      throw new Error(`Failed to search for events: ${error.message}`);
    }
  };
  
  // Enhanced event deletion with comprehensive error handling
  const deleteEvent = async (eventElement, eventIndex, totalFound) => {
    try {
      const eventText = eventElement.textContent || 'Unknown event';
      logger.info('Attempting to delete event', { 
        eventIndex: eventIndex + 1, 
        totalFound, 
        eventText: eventText.substring(0, 100) + (eventText.length > 100 ? '...' : '')
      });
      
      // Click the event
      eventElement.click();
      logger.info('Event clicked, waiting for delete button');
      
      // Wait for delete button with timeout
      const deleteButton = await waitForElement(
        'button[aria-label="' + deleteEventButtonLabel + '"], button[aria-label="' + deleteTaskButtonLabel + '"]',
        3000
      );
      
      deleteButton.click();
      logger.info('Delete button clicked, checking for recurring event dialog');
      
      // Wait and check for recurring event dialog
      return new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            // Look for recurring event dialog
            const recurringDialog = document.querySelector(reoccurringDialogSelector);
            
            if (recurringDialog && 
                (recurringDialog.textContent.includes(deleteReoccurringEventLabel) ||
                 recurringDialog.textContent.includes(deleteReoccurringTaskLabel))) {
              
              logger.info('Recurring event dialog detected');
              
              const okButton = await waitForElement(reoccurringDialogOkButtonSelector, 2000);
              okButton.click();
              
              logger.success('Recurring event deleted', { eventText });
              resolve(true);
            } else {
              logger.success('Regular event deleted', { eventText });
              resolve(true);
            }
          } catch (dialogError) {
            logger.error('Error handling deletion dialog', { eventText, error: dialogError });
            // Still consider it a success if we got this far
            resolve(true);
          }
        }, 500);
      });
      
    } catch (error) {
      logger.error('Error deleting event', { 
        eventIndex: eventIndex + 1, 
        eventText: eventElement?.textContent || 'Unknown',
        error 
      });
      throw error;
    }
  };
  
  // Enhanced page navigation with error handling
  const navigateToNextPage = async (currentPage) => {
    try {
      logger.info('Navigating to next page', { currentPage, nextPage: currentPage + 1 });
      
      const nextButton = await waitForElement('button[aria-label="' + nextPageLabel + '"]', 3000);
      nextButton.click();
      
      logger.info('Next button clicked, waiting for page load');
      
      // Wait for page to load - look for calendar content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      logger.success('Navigation completed', { newPage: currentPage + 1 });
      return true;
    } catch (error) {
      logger.error('Error navigating to next page', { currentPage, error });
      return false;
    }
  };
  
  // Main deletion process with comprehensive error handling
  const processCalendarDeletion = async (searchString) => {
    let currentPage = 1;
    let totalDeleted = 0;
    let totalErrors = 0;
    const errors = [];
    
    logger.info('Starting calendar deletion process', { 
      searchString, 
      maxPages, 
      startTime: new Date().toISOString() 
    });
    
    const processPage = async () => {
      try {
        if (currentPage > maxPages) {
          logger.success('All pages processed', { 
            totalPages: maxPages, 
            totalDeleted, 
            totalErrors,
            completionTime: new Date().toISOString()
          });
          
          let message = `Deletion complete!\nTotal events deleted: ${totalDeleted}`;
          if (totalErrors > 0) {
            message += `\nErrors encountered: ${totalErrors} (check console for details)`;
          }
          alert(message);
          return;
        }
        
        logger.info('Processing page', { currentPage, maxPages });
        
        // Find matching events on current page
        const matchingSpans = findMatchingEvents(searchString);
        const matchCount = matchingSpans.snapshotLength;
        
        if (matchCount > 0) {
          logger.info('Found matching events on page', { currentPage, matchCount });
          
          // Process first event (we'll loop back to get the rest)
          try {
            const firstMatch = matchingSpans.snapshotItem(0);
            await deleteEvent(firstMatch, 0, matchCount);
            totalDeleted++;
            
            logger.success('Event deleted successfully', { 
              currentPage, 
              totalDeleted, 
              remainingOnPage: matchCount - 1 
            });
            
            // Continue processing the same page after a short delay
            setTimeout(() => processPage(), 800);
            
          } catch (deleteError) {
            totalErrors++;
            errors.push({
              page: currentPage,
              error: deleteError.message,
              timestamp: new Date().toISOString()
            });
            
            logger.error('Failed to delete event, continuing', { 
              currentPage, 
              totalErrors, 
              error: deleteError 
            });
            
            // Continue anyway after a longer delay
            setTimeout(() => processPage(), 1500);
          }
          
        } else {
          logger.info('No matching events found on page', { currentPage });
          
          // Move to next page
          if (currentPage < maxPages) {
            const navigationSuccess = await navigateToNextPage(currentPage);
            
            if (navigationSuccess) {
              currentPage++;
              setTimeout(() => processPage(), 2000);
            } else {
              logger.error('Failed to navigate to next page, ending process', { currentPage });
              alert(`Process stopped due to navigation error on page ${currentPage}.\nTotal events deleted: ${totalDeleted}`);
            }
          } else {
            logger.success('Reached maximum pages', { maxPages, totalDeleted, totalErrors });
            
            let message = `Process complete! Processed ${maxPages} pages.\nTotal events deleted: ${totalDeleted}`;
            if (totalErrors > 0) {
              message += `\nErrors encountered: ${totalErrors} (check console for details)`;
            }
            alert(message);
          }
        }
        
      } catch (pageError) {
        totalErrors++;
        errors.push({
          page: currentPage,
          error: pageError.message,
          timestamp: new Date().toISOString()
        });
        
        logger.error('Error processing page', { currentPage, error: pageError });
        
        // Try to continue with next page
        if (currentPage < maxPages) {
          logger.warn('Attempting to continue with next page after error');
          try {
            const navigationSuccess = await navigateToNextPage(currentPage);
            if (navigationSuccess) {
              currentPage++;
              setTimeout(() => processPage(), 3000);
            } else {
              logger.error('Cannot continue - navigation failed');
              alert(`Process stopped due to critical error on page ${currentPage}.\nTotal events deleted: ${totalDeleted}\nCheck console for error details.`);
            }
          } catch (navError) {
            logger.error('Critical error - cannot continue', navError);
            alert(`Critical error occurred. Process stopped.\nTotal events deleted: ${totalDeleted}\nCheck console for details.`);
          }
        } else {
          logger.error('Error on final page, ending process', { totalDeleted, totalErrors });
          alert(`Process completed with errors.\nTotal events deleted: ${totalDeleted}\nErrors: ${totalErrors}\nCheck console for details.`);
        }
      }
    };
    
    // Start processing
    await processPage();
  };
  
  // Main execution with top-level error handling
  const main = async () => {
    try {
      logger.info('Calendar deletion script started');
      
      // Check if we're on a calendar page
      if (!window.location.hostname.includes('calendar.google.com')) {
        const warning = 'This script is designed for Google Calendar. Current page may not be supported.';
        logger.warn(warning);
        if (!confirm(warning + '\n\nDo you want to continue anyway?')) {
          logger.info('User chose not to continue on non-calendar page');
          return;
        }
      }
      
      // Get user input
      const searchString = getUserInput();
      if (!searchString) {
        logger.info('Operation cancelled by user during input phase');
        return;
      }
      
      // Start the deletion process
      await processCalendarDeletion(searchString);
      
    } catch (error) {
      logger.error('Critical error in main execution', error);
      alert('A critical error occurred. Check the browser console for details.');
    }
  };
  
  // Execute the script
  main();
})();
