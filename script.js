(() => {
  const ADVANCED_MODE = false;

  // Strongly recommended: run once with this true.
  // Set to false only after confirming the console output looks right.
  const DRY_RUN = true;

  const caseInsensitiveSearch = true;

  // If true, the script assumes the months/pages you process belong to targetYear.
  // This matters because Google Calendar often omits the year from event popups.
  //
  // Recommended workflow:
  // 1. Navigate Google Calendar to January of the target year.
  // 2. Set max months/pages to 12.
  // 3. Keep ASSUME_CURRENT_PAGES_ARE_TARGET_YEAR = true.
  const ASSUME_CURRENT_PAGES_ARE_TARGET_YEAR = true;

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

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const normalizeText = (value) => {
    const text = String(value || '');
    return caseInsensitiveSearch ? text.toLowerCase() : text;
  };

  const includesSearch = (text, searchString) => {
    return normalizeText(text).includes(normalizeText(searchString));
  };

  const getAndValidateInput = (key, message, defaultValue, advancedMode) => {
    if (advancedMode !== true) {
      return defaultValue;
    }

    const result = prompt(message, defaultValue);

    if (result === null) {
      logger.warn('User cancelled input dialog');
      alert(`No value for ${key} provided. Operation cancelled.`);
      return null;
    }

    if (String(result).trim() === '') {
      logger.warn('User provided empty string after trimming');
      alert(`Value for ${key} cannot be empty. Operation cancelled.`);
      return null;
    }

    const trimmedResult = String(result).trim();
    logger.info(`Value for ${key} collected`, {
      string: trimmedResult,
      length: trimmedResult.length
    });

    return trimmedResult;
  };

  const escapeXPathString = (str) => {
    str = String(str);

    if (!str.includes("'")) {
      return `'${str}'`;
    }

    if (!str.includes('"')) {
      return `"${str}"`;
    }

    return "concat('" + str.replace(/'/g, "',\"'\",'") + "')";
  };

  const reoccurringDialogSelector = 'span.uW2Fw-k2Wrsb-fmcmS[jsname="MdSI6d"]';
  const reoccurringDialogOkButtonSelector = '[data-mdc-dialog-action="ok"]';

  const closeButtonSelectors = [
    'button[aria-label="Close"]',
    'button[aria-label="Back"]',
    'button[jsname="A5il2e"]',
    'button[jsname="TvD9Pc"]'
  ];

  let nextPageLabel;
  let deleteEventButtonLabel;
  let deleteTaskButtonLabel;
  let deleteReoccurringEventLabel;
  let deleteReoccurringTaskLabel;
  let maxPages;
  let targetYear;

  const getUserInput = () => {
    logger.info('Starting user input collection');

    try {
      nextPageLabel = getAndValidateInput(
        'nextPageLabel',
        'Next page label',
        'Next month',
        ADVANCED_MODE
      );

      deleteEventButtonLabel = getAndValidateInput(
        'deleteEventButtonLabel',
        'Delete event label',
        'Delete event',
        ADVANCED_MODE
      );

      deleteTaskButtonLabel = getAndValidateInput(
        'deleteTaskButtonLabel',
        'Delete task label',
        'Delete task',
        ADVANCED_MODE
      );

      deleteReoccurringEventLabel = getAndValidateInput(
        'deleteReoccurringEventLabel',
        'Delete reoccurring event label',
        'Delete repeating event',
        ADVANCED_MODE
      );

      deleteReoccurringTaskLabel = getAndValidateInput(
        'deleteReoccurringTaskLabel',
        'Delete reoccurring task label',
        'Delete recurring task',
        ADVANCED_MODE
      );

      const maxPagesRaw = getAndValidateInput(
        'maxPages',
        'Max months to process. For one year, use 12. Start on January of that year.',
        '12',
        true
      );

      if (maxPagesRaw === null) {
        return null;
      }

      maxPages = Number.parseInt(maxPagesRaw, 10);

      if (!Number.isFinite(maxPages) || maxPages < 1 || maxPages > 120) {
        alert('Max months must be a number between 1 and 120. Operation cancelled.');
        return null;
      }

      const targetYearRaw = getAndValidateInput(
        'targetYear',
        'Target year to delete from. Example: 2026',
        String(new Date().getFullYear()),
        true
      );

      if (targetYearRaw === null) {
        return null;
      }

      targetYear = Number.parseInt(targetYearRaw, 10);

      if (!Number.isFinite(targetYear) || targetYear < 1900 || targetYear > 2100) {
        alert('Target year must be a valid year between 1900 and 2100. Operation cancelled.');
        return null;
      }

      const trimmedSearch = getAndValidateInput(
        'trimmedSearch',
        'Enter the text/string to search for in calendar event titles OR descriptions. Example: in-the-sky.org',
        'in-the-sky.org',
        true
      );

      if (!trimmedSearch) {
        return null;
      }

      const confirmation = confirm(
        `Are you sure you want to ${DRY_RUN ? 'FIND' : 'DELETE'} events containing "${trimmedSearch}" in their title or description, only for year ${targetYear}?\n\n` +
        `${DRY_RUN ? 'DRY RUN IS ENABLED. Events will be opened and logged, but not deleted.\n\n' : 'This action cannot be undone.\n\n'}` +
        'Recommended setup:\n' +
        `1. Navigate to January ${targetYear} before running.\n` +
        `2. Use 12 months/pages to process the full year.\n\n` +
        'The script will:\n' +
        `1. Search through up to ${maxPages} months/pages of your calendar\n` +
        '2. Open visible events to check their title/details/description\n' +
        `3. Only match events containing "${trimmedSearch}" and belonging to ${targetYear}\n` +
        `${DRY_RUN ? '4. Log matching events without deleting them\n\n' : '4. Delete matching events\n\n'}` +
        'Click OK to proceed or Cancel to abort.'
      );

      if (!confirmation) {
        logger.info('User declined confirmation dialog');
        return null;
      }

      logger.success('User input validated and confirmed', {
        searchString: trimmedSearch,
        targetYear,
        maxPages,
        dryRun: DRY_RUN,
        caseInsensitiveSearch,
        assumeCurrentPagesAreTargetYear: ASSUME_CURRENT_PAGES_ARE_TARGET_YEAR
      });

      return trimmedSearch;
    } catch (error) {
      logger.error('Error during user input collection', error);
      alert('An error occurred while collecting input. Please try again.');
      return null;
    }
  };

  const waitForElement = (selector, timeout = 5000, retryInterval = 100) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkElement = () => {
        try {
          const element = document.querySelector(selector);

          if (element) {
            logger.info('Element found', {
              selector,
              timeWaited: Date.now() - startTime
            });
            resolve(element);
            return;
          }

          if (Date.now() - startTime >= timeout) {
            logger.warn('Element not found within timeout', {
              selector,
              timeout
            });
            reject(new Error(`Element ${selector} not found within ${timeout}ms`));
            return;
          }

          setTimeout(checkElement, retryInterval);
        } catch (error) {
          logger.error('Error while waiting for element', {
            selector,
            error
          });
          reject(error);
        }
      };

      checkElement();
    });
  };

  const getVisibleText = (element) => {
    return String(element?.textContent || '').replace(/\s+/g, ' ').trim();
  };

  const isVisible = (element) => {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= window.innerHeight &&
      rect.left <= window.innerWidth
    );
  };

  const getClickableEventElement = (element) => {
    if (!element) return null;

    return (
      element.closest('[role="button"]') ||
      element.closest('[data-eventid]') ||
      element.closest('[jscontroller]') ||
      element
    );
  };

  const uniqueElements = (elements) => {
    return [...new Set(elements.filter(Boolean))];
  };

  const closeOpenEventPanel = async () => {
    for (const selector of closeButtonSelectors) {
      const button = document.querySelector(selector);
      if (button && isVisible(button)) {
        logger.info('Closing open event panel', { selector });
        button.click();
        await sleep(500);
        return true;
      }
    }

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true
    }));

    await sleep(500);
    return true;
  };

  const getOpenEventDetailsText = () => {
    const candidateSelectors = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      'div[jscontroller][role="dialog"]',
      'div[data-eventid]',
      'div[jsname]'
    ];

    const candidates = [];

    for (const selector of candidateSelectors) {
      document.querySelectorAll(selector).forEach(element => {
        if (isVisible(element)) {
          const text = getVisibleText(element);
          if (text.length > 0) {
            candidates.push(text);
          }
        }
      });
    }

    const combined = uniqueElements(candidates).join('\n');

    logger.info('Collected open event details text', {
      length: combined.length,
      preview: combined.substring(0, 300)
    });

    return combined;
  };

  const eventAppearsToBeInTargetYear = (detailsText, currentPage) => {
    const text = String(detailsText || '');

    // Direct explicit year match, if Google Calendar shows it.
    const explicitYearPattern = new RegExp(`\\b${targetYear}\\b`);
    if (explicitYearPattern.test(text)) {
      return {
        inTargetYear: true,
        reason: `Opened event details explicitly contain ${targetYear}`
      };
    }

    // If details show a different explicit 4-digit year, reject.
    const otherYearMatch = text.match(/\b(19|20|21)\d{2}\b/g);
    const uniqueYears = [...new Set(otherYearMatch || [])];

    if (uniqueYears.length > 0 && !uniqueYears.includes(String(targetYear))) {
      return {
        inTargetYear: false,
        reason: `Opened event details contain other year(s): ${uniqueYears.join(', ')}`
      };
    }

    // Google Calendar often omits the year in the opened event popup.
    // If the user started on January of the target year and is scanning 12 months,
    // then we treat those pages as target year pages.
    if (ASSUME_CURRENT_PAGES_ARE_TARGET_YEAR) {
      return {
        inTargetYear: true,
        reason: `No explicit conflicting year found; assuming current scanned page ${currentPage} is within ${targetYear}`
      };
    }

    return {
      inTargetYear: false,
      reason: `No explicit ${targetYear} found in opened event details`
    };
  };

  const findMatchingVisibleEvents = (searchString) => {
    try {
      logger.info('Searching for visible matching events', { searchString });

      const escapedSearch = escapeXPathString(searchString);

      const xpath = caseInsensitiveSearch
        ? `//*[contains(translate(normalize-space(.), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), ${escapeXPathString(searchString.toLowerCase())})]`
        : `//*[contains(normalize-space(.), ${escapedSearch})]`;

      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const matches = [];

      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);

        if (!node || !isVisible(node)) {
          continue;
        }

        const clickable = getClickableEventElement(node);

        if (!clickable || !isVisible(clickable)) {
          continue;
        }

        const text = getVisibleText(clickable);
        if (!text || text.length < 1) {
          continue;
        }

        const ariaLabel = clickable.getAttribute('aria-label') || '';
        const combinedText = `${text} ${ariaLabel}`;

        if (includesSearch(combinedText, searchString)) {
          matches.push(clickable);
        }
      }

      const uniqueMatches = uniqueElements(matches);

      logger.info('Visible search completed', {
        xpath,
        rawMatchCount: result.snapshotLength,
        clickableMatchCount: uniqueMatches.length,
        searchString
      });

      return uniqueMatches;
    } catch (error) {
      logger.error('Error during visible search', {
        searchString,
        error
      });
      throw new Error(`Failed to search visible events: ${error.message}`);
    }
  };

  const findVisibleCalendarItemsForDescriptionScan = () => {
    const selectors = [
      '[role="button"][aria-label]',
      '[data-eventid]',
      'div[role="button"]',
      'span[role="button"]'
    ];

    const candidates = [];

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach(element => {
        if (!isVisible(element)) return;

        const text = getVisibleText(element);
        const ariaLabel = element.getAttribute('aria-label') || '';
        const combined = `${text} ${ariaLabel}`.trim();
        const lower = combined.toLowerCase();

        const looksLikeControl =
          lower === '' ||
          lower.includes('next month') ||
          lower.includes('previous month') ||
          lower.includes('today') ||
          lower.includes('settings') ||
          lower.includes('create') ||
          lower.includes('main menu') ||
          lower.includes('search') ||
          lower.includes('support') ||
          lower.includes('google apps') ||
          lower.includes('account');

        if (!looksLikeControl) {
          candidates.push(getClickableEventElement(element));
        }
      });
    }

    const uniqueCandidates = uniqueElements(candidates);

    logger.info('Found visible calendar item candidates for description scan', {
      count: uniqueCandidates.length,
      previews: uniqueCandidates.slice(0, 10).map(el => getVisibleText(el).substring(0, 80))
    });

    return uniqueCandidates;
  };

  const deleteOpenEvent = async (eventText) => {
    if (DRY_RUN) {
      logger.warn('DRY RUN: would delete event', { eventText });
      await closeOpenEventPanel();
      return true;
    }

    const deleteButton = await waitForElement(
      `button[aria-label="${deleteEventButtonLabel}"], button[aria-label="${deleteTaskButtonLabel}"]`,
      3000
    );

    deleteButton.click();
    logger.info('Delete button clicked, checking for recurring event dialog');

    await sleep(500);

    try {
      const recurringDialog = document.querySelector(reoccurringDialogSelector);

      if (
        recurringDialog &&
        (
          recurringDialog.textContent.includes(deleteReoccurringEventLabel) ||
          recurringDialog.textContent.includes(deleteReoccurringTaskLabel)
        )
      ) {
        logger.info('Recurring event dialog detected');

        const okButton = await waitForElement(reoccurringDialogOkButtonSelector, 2000);
        okButton.click();

        logger.success('Recurring event deleted', { eventText });
        return true;
      }

      logger.success('Regular event deleted', { eventText });
      return true;
    } catch (dialogError) {
      logger.error('Error handling deletion dialog', {
        eventText,
        error: dialogError
      });

      return true;
    }
  };

  const openEventAndCheckDetails = async (eventElement, searchString, currentPage) => {
    const eventTextBeforeOpen = getVisibleText(eventElement) || 'Unknown event';

    logger.info('Opening event to check title/details/description/year', {
      eventTextBeforeOpen: eventTextBeforeOpen.substring(0, 150),
      currentPage,
      targetYear
    });

    eventElement.click();
    await sleep(1000);

    const detailsText = getOpenEventDetailsText();
    const combinedText = `${eventTextBeforeOpen}\n${detailsText}`;

    const textMatched = includesSearch(combinedText, searchString);
    const yearCheck = eventAppearsToBeInTargetYear(detailsText, currentPage);

    const matched = textMatched && yearCheck.inTargetYear;

    logger.info('Checked opened event', {
      matched,
      textMatched,
      yearMatched: yearCheck.inTargetYear,
      yearReason: yearCheck.reason,
      eventPreview: eventTextBeforeOpen.substring(0, 150),
      detailsPreview: detailsText.substring(0, 300)
    });

    return {
      matched,
      textMatched,
      yearMatched: yearCheck.inTargetYear,
      yearReason: yearCheck.reason,
      eventText: eventTextBeforeOpen,
      detailsText
    };
  };

  const deleteEvent = async (eventElement, eventIndex, totalFound, searchString, currentPage) => {
    try {
      const eventText = getVisibleText(eventElement) || 'Unknown event';

      logger.info('Attempting event check/delete', {
        eventIndex: eventIndex + 1,
        totalFound,
        eventText: eventText.substring(0, 100) + (eventText.length > 100 ? '...' : ''),
        currentPage,
        targetYear
      });

      const check = await openEventAndCheckDetails(
        eventElement,
        searchString,
        currentPage
      );

      if (!check.matched) {
        logger.info('Opened event did not match search text and target year; closing', {
          eventText,
          textMatched: check.textMatched,
          yearMatched: check.yearMatched,
          yearReason: check.yearReason
        });

        await closeOpenEventPanel();
        return false;
      }

      logger.success('Event matched search text and target year', {
        eventText,
        targetYear,
        dryRun: DRY_RUN,
        yearReason: check.yearReason
      });

      await deleteOpenEvent(eventText);
      return true;
    } catch (error) {
      logger.error('Error deleting/checking event', {
        eventIndex: eventIndex + 1,
        eventText: eventElement?.textContent || 'Unknown',
        error
      });

      try {
        await closeOpenEventPanel();
      } catch (_) {}

      throw error;
    }
  };

  const navigateToNextPage = async (currentPage) => {
    try {
      logger.info('Navigating to next page', {
        currentPage,
        nextPage: currentPage + 1
      });

      const nextButton = await waitForElement(
        `button[aria-label="${nextPageLabel}"]`,
        3000
      );

      nextButton.click();

      logger.info('Next button clicked, waiting for page load');

      await sleep(2000);

      logger.success('Navigation completed', {
        newPage: currentPage + 1
      });

      return true;
    } catch (error) {
      logger.error('Error navigating to next page', {
        currentPage,
        error
      });

      return false;
    }
  };

  const processCalendarDeletion = async (searchString) => {
    let currentPage = 1;
    let totalDeleted = 0;
    let totalMatchedDryRun = 0;
    let totalChecked = 0;
    let totalErrors = 0;
    const errors = [];

    logger.info('Starting calendar deletion process', {
      searchString,
      targetYear,
      maxPages,
      dryRun: DRY_RUN,
      startTime: new Date().toISOString()
    });

    const processPage = async () => {
      try {
        if (currentPage > maxPages) {
          logger.success('All pages processed', {
            totalPages: maxPages,
            totalDeleted,
            totalMatchedDryRun,
            totalChecked,
            totalErrors,
            completionTime: new Date().toISOString()
          });

          let message =
            `${DRY_RUN ? 'Dry run complete!' : 'Deletion complete!'}\n` +
            `Target year: ${targetYear}\n` +
            `Total events checked: ${totalChecked}\n` +
            `${DRY_RUN ? `Total matching events found: ${totalMatchedDryRun}` : `Total events deleted: ${totalDeleted}`}`;

          if (totalErrors > 0) {
            message += `\nErrors encountered: ${totalErrors} — check console for details`;
          }

          alert(message);
          return;
        }

        logger.info('Processing page', {
          currentPage,
          maxPages,
          targetYear
        });

        const visibleTitleMatches = findMatchingVisibleEvents(searchString);
        const descriptionScanCandidates = findVisibleCalendarItemsForDescriptionScan();

        const candidates = uniqueElements([
          ...visibleTitleMatches,
          ...descriptionScanCandidates
        ]);

        logger.info('Total event candidates to inspect on page', {
          currentPage,
          candidates: candidates.length,
          visibleTitleMatches: visibleTitleMatches.length,
          descriptionScanCandidates: descriptionScanCandidates.length
        });

        if (candidates.length > 0) {
          let deletedOrMatchedOnThisPage = 0;

          for (let i = 0; i < candidates.length; i++) {
            const candidate = candidates[i];

            if (!candidate || !document.body.contains(candidate) || !isVisible(candidate)) {
              logger.warn('Skipping stale or invisible candidate', {
                index: i + 1
              });
              continue;
            }

            try {
              totalChecked++;

              const wasDeletedOrMatched = await deleteEvent(
                candidate,
                i,
                candidates.length,
                searchString,
                currentPage
              );

              if (wasDeletedOrMatched) {
                deletedOrMatchedOnThisPage++;

                if (DRY_RUN) {
                  totalMatchedDryRun++;
                } else {
                  totalDeleted++;

                  logger.info('Real deletion performed; rescanning page after short delay');
                  await sleep(1000);
                  setTimeout(() => processPage(), 800);
                  return;
                }
              }

              await sleep(500);
            } catch (deleteError) {
              totalErrors++;

              errors.push({
                page: currentPage,
                error: deleteError.message,
                timestamp: new Date().toISOString()
              });

              logger.error('Failed to check/delete event, continuing', {
                currentPage,
                totalErrors,
                error: deleteError
              });

              await sleep(1000);
            }
          }

          logger.info('Finished inspecting candidates on page', {
            currentPage,
            deletedOrMatchedOnThisPage
          });
        } else {
          logger.info('No event candidates found on page', {
            currentPage
          });
        }

        if (currentPage < maxPages) {
          const navigationSuccess = await navigateToNextPage(currentPage);

          if (navigationSuccess) {
            currentPage++;
            setTimeout(() => processPage(), 2000);
          } else {
            logger.error('Failed to navigate to next page, ending process', {
              currentPage
            });

            alert(
              `Process stopped due to navigation error on page ${currentPage}.\n` +
              `Target year: ${targetYear}\n` +
              `Total events checked: ${totalChecked}\n` +
              `${DRY_RUN ? `Total matching events found: ${totalMatchedDryRun}` : `Total events deleted: ${totalDeleted}`}`
            );
          }
        } else {
          logger.success('Reached maximum pages', {
            maxPages,
            targetYear,
            totalDeleted,
            totalMatchedDryRun,
            totalChecked,
            totalErrors
          });

          let message =
            `${DRY_RUN ? 'Dry run complete!' : 'Process complete!'} Processed ${maxPages} pages.\n` +
            `Target year: ${targetYear}\n` +
            `Total events checked: ${totalChecked}\n` +
            `${DRY_RUN ? `Total matching events found: ${totalMatchedDryRun}` : `Total events deleted: ${totalDeleted}`}`;

          if (totalErrors > 0) {
            message += `\nErrors encountered: ${totalErrors} — check console for details`;
          }

          alert(message);
        }
      } catch (pageError) {
        totalErrors++;

        errors.push({
          page: currentPage,
          error: pageError.message,
          timestamp: new Date().toISOString()
        });

        logger.error('Error processing page', {
          currentPage,
          error: pageError
        });

        try {
          await closeOpenEventPanel();
        } catch (_) {}

        if (currentPage < maxPages) {
          logger.warn('Attempting to continue with next page after error');

          try {
            const navigationSuccess = await navigateToNextPage(currentPage);

            if (navigationSuccess) {
              currentPage++;
              setTimeout(() => processPage(), 3000);
            } else {
              logger.error('Cannot continue — navigation failed');
              alert(
                `Process stopped due to critical error on page ${currentPage}.\n` +
                `Target year: ${targetYear}\n` +
                `Total events checked: ${totalChecked}\n` +
                `${DRY_RUN ? `Total matching events found: ${totalMatchedDryRun}` : `Total events deleted: ${totalDeleted}`}\n` +
                'Check console for error details.'
              );
            }
          } catch (navError) {
            logger.error('Critical error — cannot continue', navError);

            alert(
              `Critical error occurred. Process stopped.\n` +
              `Target year: ${targetYear}\n` +
              `Total events checked: ${totalChecked}\n` +
              `${DRY_RUN ? `Total matching events found: ${totalMatchedDryRun}` : `Total events deleted: ${totalDeleted}`}\n` +
              'Check console for details.'
            );
          }
        } else {
          logger.error('Error on final page, ending process', {
            targetYear,
            totalDeleted,
            totalMatchedDryRun,
            totalChecked,
            totalErrors
          });

          alert(
            `Process completed with errors.\n` +
            `Target year: ${targetYear}\n` +
            `Total events checked: ${totalChecked}\n` +
            `${DRY_RUN ? `Total matching events found: ${totalMatchedDryRun}` : `Total events deleted: ${totalDeleted}`}\n` +
            `Errors: ${totalErrors}\n` +
            'Check console for details.'
          );
        }
      }
    };

    await processPage();
  };

  const main = async () => {
    try {
      logger.info('Calendar deletion script started', {
        dryRun: DRY_RUN
      });

      if (!window.location.hostname.includes('calendar.google.com')) {
        const warning = 'This script is designed for Google Calendar. Current page may not be supported.';
        logger.warn(warning);

        if (!confirm(warning + '\n\nDo you want to continue anyway?')) {
          logger.info('User chose not to continue on non-calendar page');
          return;
        }
      }

      const searchString = getUserInput();

      if (!searchString) {
        logger.info('Operation cancelled by user during input phase');
        return;
      }

      await processCalendarDeletion(searchString);
    } catch (error) {
      logger.error('Critical error in main execution', error);
      alert('A critical error occurred. Check the browser console for details.');
    }
  };

  main();
})();
