// from the No Style Style Guide:

var contextPathVal = contextPath;

var unassignedUserValue = "NONE";
var unassignedTeamValue = "NONE";
var unselectedOptionValue = "SELECT";
var assignToCurrentTeamValue = "CURRENT_TEAM";

var completeNoteDefault = "Enter a complete assignment note";
var reassignNoteDefault = "Enter a reassignment note";
var unassignNoteDefault = "Enter an unassignment note";
var brokerNoteDefault = "Enter a brokering note";
var transferWorkItemDefault = "Enter a transfer note";
var emptyNwqTransferLocation = "Enter a transfer location";
var emptyDivisionBrokeringLocation = "Please select a regional office or division.";
var invalidNwqTransferLocation = "The selected transfer location is invalid";
var invalidDivisionBrokeringLocation = "The selected regional office or division is invalid";
var currentRequest = null;

var isDetails;
var nwqTransferLocationLabels;
var reassignLocationLabels;
var claimAuthoritiesLabels;
var validClaimLocationLabels;

$(document).ready(function () {

	/*
	 **************************
	 * Modal Dialog Functions *
	 **************************
	 */

	$("#completeWorkItemModal").dialog({
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: "auto",
		title: '<h1>Complete Work Item</h1>',
		close: function () {
			$(this).parent().untrap();
			$("#actionSelect_wid").val("select"); // Work Item Details
			$("#select-actions").val("select"); // Work Queue Inbox

			//clear "ClaimStatuses" SELECT control:
			$("#completionClaimStatusesSelect")[0].options.length = 0;
			//clear "Reasons" SELECT control and disable:
			$("#closeWorkItemReasonsSelect")[0].options.length = 0;
            workQueueModals.disableElement($("#closeWorkItemReasonsSelect"));
			//clear "Users" SELECT control and disable:
			$("#completeUsersSelect")[0].options.length = 0;
            workQueueModals.disableElement($("#completeUsersSelect"));
            //clear "Teams" SELECT control and disable:
            $("#completeTeamsSelect")[0].options.length = 0;
            workQueueModals.disableElement($("#completeTeamsSelect"));
			workQueueModals.disableElement($("#completeWorkItemClaimLocationTypeahead"));

            //empty workItem table:
			workQueueModals.emptyWorkItemTable($("#completeWorkItemsTable"));
			$("#completeWorkItemsError").hide();

			$("#completeSubmitButton").removeAttr("disabled");
			$("#completeErrorDiv").hide();
            $("#unassignedUserWarning").hide();

            workQueueModals.resetActions();
		},
		open: function () {
            var workItemId;
            var fileNumber;
            var claimId;

            if(typeof workItemDetails !== 'undefined') {
                workItemId = workItemDetails.getDetailWorkItemId();
                fileNumber = workItemDetails.getDetailWorkItemFileNumber();
                claimId = workItemDetails.getDetailClaimId();
            }
            else if(typeof claimDetail !== 'undefined') {
                workItemId = claimDetail.getDetailWorkItemId();
                fileNumber = claimDetail.getDetailWorkItemFileNumber();
                claimId = claimDetail.getDetailClaimId();
            }

            $(this).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			$("#completeNote").val(completeNoteDefault);

            $("#deferralError").hide();
            workQueueModals.disableElement($("#completeWorkItemClaimLocationTypeahead"));
            $("#completeSubmitButton").attr("disabled", true);
            var uploadPending = checkForPendingUploads(fileNumber);
			workQueueModals.populateClaimStatusesForCompletionMain(uploadPending,workItemId);
            $("#completeSubmitButton").attr("disabled", false);

            if ($('#workItemsEnableSetManagement').val() == 'true') {
                $("#completeWorkItemsArea").html("");
                workQueueModals.populateAssociatedClaimsForCompletionMain(workItemId, fileNumber, claimId);
            }

            workQueueModals.checkForDeferralsMain(workItemId, fileNumber);
        },
		buttons: [
			{
				id: "completeCancelButton",
				text: "Cancel",
				click: function () {
					$(this).dialog("close");
					workQueueModals.resetActions();
				}
			},
			{
				id: "completeSubmitButton",
				text: "Submit",
				click: function () {
					$("#completeSubmitButton").attr("disabled", "disabled");

					var claimStatus = $("#completionClaimStatusesSelect").val();

					if ($('#workItemsAutomatedClosureEnabled').val() == 'true' &&
							((claimStatus === 'CLOSED') || (claimStatus === 'CANCELLED')) &&
							workQueueModals.checkFormErrorBeforePrompt() === false) {

						var claimId;
						if(typeof workItemDetails !== 'undefined') {
							claimId = workItemDetails.getDetailClaimId();
						} else if(typeof claimDetail !== 'undefined') {
							claimId = claimDetail.getDetailClaimId();
						}

						countNumOfNonTermESR(claimId,
							null,
							$("#completeErrorPlaceholder"),
							$("#completeErrorDiv"),
							function(nonTermESRNum) {
								if(nonTermESRNum > 0) {
									$("#promptUserOpenESR").data('nonTermESRNum', nonTermESRNum).data('claimId', claimId).dialog('open');
								} else {
									workQueueModals.showOverlay();
									workQueueModals.completeWorkItemMain();
								}
						});
					} else {
						workQueueModals.showOverlay();
						workQueueModals.completeWorkItemMain();
					}
				}
			}
		]
	});
	$("#promptUserOpenESR").dialog({
		dialogClass: "no-close",
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: "auto",
		title: '<h1>Complete Work Item Confirmation</h1>',
		close: function () {
			$(this).parent().untrap();
			var message = $('#promptUserOpenESRStr').html();
			message = message.substring(0, message.lastIndexOf(">") + 1);
			$('#promptUserOpenESRStr').html(message);
		},
		open: function () {
			$(this).parent().trap();
			$(this).parent().focus();
			var message = $('#promptUserOpenESRStr').html();
			message = message.substring(0, message.lastIndexOf(">") + 1);
			if ($(this).data("nonTermESRNum") === 1) {
				message = message + "There is currently " + $(this).data("nonTermESRNum") + " ESR pending appointments or results.";
			} else {
				message = message + "There are currently " + $(this).data("nonTermESRNum") + " ESRs pending appointments or results.";
			}
			$('#promptUserOpenESRStr').html(message);
			$('#promptUserOpenESRMsg').show();
		},
		buttons: [
			{
				id: "promptCancelButton",
				text: "Cancel",
				click: function () {
					var claimId = $(this).data("claimId");
					var action = "User did not cancel EP in Core";
					auditUserPromptChoice(claimId,
						action,
						null,
						$("#completeErrorPlaceholder"),
						$("#completeErrorDiv"));
					$(this).dialog("close");
					$("#completeWorkItemModal").dialog("close");
					workQueueModals.resetActions();
				}
			},
			{
				id: "promptContinueButton",
				text: "Continue",
				click: function () {
					var claimId = $(this).data("claimId");
					var action = "User canceled EP in Core";
					auditUserPromptChoice(claimId,
						action,
						null,
						$("#completeErrorPlaceholder"),
						$("#completeErrorDiv"));

					workQueueModals.showOverlay();
					workQueueModals.completeWorkItemMain();
				}
			}
		]
	});
	$("#reassignWorkItemModal").dialog({
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: 500,
		title: '<h1>Reassign Work Item</h1>',
		close: function () {
			$(this).parent().untrap();
			$("#actionSelect_wid").val("select"); // Work Item Details
			$("#select-actions").val("select"); // Work Queue Inbox

			//clear "Priority" SELECT control:
            var $reassignPrioritySelect = $("#reassignPrioritySelect");

            if($reassignPrioritySelect.length != 0){
                $reassignPrioritySelect[0].options.length = 0;
            }

			//clear "Users" SELECT control:
			$("#reassignUsersSelect")[0].options.length = 0;
			//clear "Teams" SELECT control:
			$("#reassignTeamsSelect")[0].options.length = 0;

			//empty workItem table:
            var $workItemsTable = $("#reassignWorkItemsTable");
			workQueueModals.emptyWorkItemTable($workItemsTable);
			$("#reassignWorkItemsError").hide();

			$("#reassignSubmitButton").removeAttr("disabled");
			$("#reassignTeamsSelect").removeAttr("disabled");
			$("#reassignErrorDiv").hide();
            $("#reassignRestrictedItemsWarningDiv").hide();
            workQueueModals.removePendingDeferralWarningMessage($("#reassignWorkItemsArea"),
                                                                $("#reassignPendingDeferralsWarningDiv"),
                                                                $workItemsTable);

			workQueueModals.resetActions();
		},
		open: function () {
			$(this).parent().trap();
			$(this).parent().find("#ui-dialog-title-reassignWorkItemModal").css("border-bottom", "none");
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			$("#reassignNote").val(reassignNoteDefault);
			
			workQueueModals.populateWorkItemPriorityForReassignMain();
			workQueueModals.populateUsersForReassignMain();
			workQueueModals.populateTeamsForReassignMain();
			workQueueModals.populateReassignLocationsForReassignClaimsModal();
			workQueueModals.populateReassignWorkItemsTableMain();
		},
		buttons: [
			{
				id: "reassignSubmitButton",
                class: "btn btn-primary",
				text: "Submit",
				click: function () {
					$("#reassignSubmitButton").attr("disabled", "disabled");

					workQueueModals.showOverlay();
					workQueueModals.reassignWorkItemMain();
				}
			},
			{
                class: "btn btn-primary",
				text: "Cancel",
				click: function () {
					$(this).dialog("close");
					workQueueModals.resetActions();
					$("#reassignTeamsSelect").removeAttr("disabled");
				}
			}
		]
	});
	$("#unassignWorkItemModal").dialog({
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: 400,
		title: '<h1>Unassign Work Item</h1>',
		close: function () {
			$(this).parent().untrap();
			$("#actionSelect_wid").val("select"); // Work Item Details
			$("#select-actions").val("select"); // Work Queue Inbox

			//clear "Priority" SELECT control:
            var $unassignPrioritySelect = $("#unassignPrioritySelect");

            if($unassignPrioritySelect.length != 0){
                $unassignPrioritySelect[0].options.length = 0;
            }

			//empty workItem table:
            var $workItemsTable = $("#unassignWorkItemsTable");
			workQueueModals.emptyWorkItemTable($workItemsTable);
			$("#unassignWorkItemsError").hide();

			$("#unassignSubmitButton").removeAttr("disabled");
			$("#unassignErrorDiv").hide();
			$("#unassignRestrictedItemsWarningDiv").hide();
			$("#unassignRestrictedWorkItemIdList").empty();
            workQueueModals.removePendingDeferralWarningMessage($("#unassignWorkItemsArea"),
                                                                $("#unassignPendingDeferralsWarningDiv"),
                                                                $workItemsTable);

            workQueueModals.resetActions();
			workQueueModals.reloadWorkQueueIfSubmitted();

		},
		open: function () {
			$(this).parent().trap();
			$(this).parent().find("#ui-dialog-title-reassignWorkItemModal").css("border-bottom", "none");
			$("#unassignNote").val(unassignNoteDefault);
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			// Ensure submission count is reset if previous modal did not reload work queue
			workQueueModals.resetSubmissionCounter();
			workQueueModals.populateWorkItemPriorityForUnassignMain();
			workQueueModals.populateUnassignWorkItemsTableMain();
		},
		buttons: [
			{
                class: "btn btn-primary",
				id: "unassignSubmitButton",
				text: "Submit",
				click: function () {
					$("#unassignSubmitButton").attr("disabled", "disabled");

					workQueueModals.showOverlay();
					workQueueModals.unassignWorkItemMain();
					workQueueModals.toggleDismissButton(this, 'Cancel');
				}
			},
			{
                class: "btn btn-primary",
				text: "Cancel",
				click: function () {
					$(this).dialog("close");
					workQueueModals.resetActions();
				}
			}
		]
	});
	$("#updateWorkItemPriorityModal").dialog({
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: 300,
		title: '<h1>Update Priority</h1>',
		close: function () {
			$(this).parent().untrap();
			$("#actionSelect_wid").val("select"); // Work Item Details
			$("#select-actions").val("select"); // Work Queue Inbox

			//clear "Priority" SELECT control:
			$("#prioritySelect")[0].options.length = 0;

			//empty workItem table:
			workQueueModals.emptyWorkItemTable($("#updatePriorityWorkItemsTable"));
			$("#updatePriorityWorkItemsError").hide();

			$("#updatePrioritySubmitButton").removeAttr("disabled");
			$("#updatePriorityErrorDiv").hide();

			$("#updatePriorityRestrictedItemsWarningDiv").hide();
			$("#updatePriorityRestrictedWorkItemIdList").empty();

            workQueueModals.resetActions();
		},
		open: function () {
			$(this).parent().trap();
			workQueueModals.showOverlay();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			workQueueModals.populateWorkItemPriorityForUpdatePriorityMain();
			workQueueModals.populateUpdatePriorityWorkItemsTableMain();
		},
		buttons: [
			{
                class: "btn btn-primary",
				text: "Cancel",
				click: function () {
					$(this).dialog("close");
					workQueueModals.resetActions();
				}
			},
			{
				id: "updatePrioritySubmitButton",
                class: "btn btn-primary",
				text: "Submit",
				click: function () {
					$("#updatePrioritySubmitButton").attr("disabled", "disabled");
                    workQueueModals.showOverlay();
                    workQueueModals.updatePriorityForWorkItemMain();
				}
			}
		]
	});
	$("#assignWorkItemToMeModal").dialog({
        dialogClass: "no-close",
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: 300,
		title: '<h1>Assign To Me</h1>',
		close: function () {
			$(this).parent().untrap();
			$("#actionSelect_wid").val("select"); // Work Item Details
			$("#select-actions").val("select"); // Work Queue Inbox

			//clear "Teams" SELECT control:
			$("#assignToMeTeamsSelect")[0].options.length = 0;

			//empty workItem table:
			workQueueModals.emptyWorkItemTable($("#assignToMeWorkItemsTable"));
			$("#assignToMeWorkItemsError").hide();

			$("#assignToMeSubmitButton").removeAttr("disabled");
			$("#assignToMeErrorDiv").hide();
			$("#assignToMeRestrictedItemsWarningDiv").hide();
			$("#assignToMeRestrictedWorkItemIdList").empty();

            workQueueModals.resetActions();
		},
		open: function () {
			$(this).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			workQueueModals.populateTeamsForAssignToMeMain();
			workQueueModals.populateAssignToMeWorkItemsTableMain();
		},
		buttons: [
			{
				class :"btn",
				text: "Cancel",
                click: function () {
					$(this).dialog("close");
					workQueueModals.resetActions();
				}
			},
			{
				id: "assignToMeSubmitButton",
				class: "btn btn-primary",
				text: "Submit",
				click: function () {
					$("#assignToMeSubmitButton").attr("disabled", "disabled");

					workQueueModals.showOverlay();
					workQueueModals.assignWorkItemToMeMain();
				}
			}
		]
	});
	$("#brokerWorkItemModal").dialog({
        dialogClass: "no-close",
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: 500,
		title: '<h1>Broker Work Items</h1>',
		close: function () {
			$(this).parent().untrap();
			$("#actionSelect_wid").val("select"); // Work Item Details
			$("#select-actions").val("select"); // Work Queue Inbox

			//clear "RegionalOffices" SELECT control:
			var select = $("#regionalOfficesSelect");
            if (select && select.length > 0) {
            	select[0].options.length = 0;
			}

			//empty workItem table:
            var brokerWorkItemsTable = $("#brokerWorkItemsTable");
			workQueueModals.emptyWorkItemTable(brokerWorkItemsTable);
			$("#brokerWorkItemsError").hide();

            //re-display work items table if it's been hidden
            brokerWorkItemsTable.show();
			$("#brokerSubmitButton").removeAttr("disabled");
			$("#brokerErrorDiv").hide();
            workQueueModals.resetActions();
		},
		open: function () {
			$(this).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			$("#brokerNote").val(brokerNoteDefault);
			if ($("#claimAuthoritiesTypeahead").length) {
				workQueueModals.populateClaimAuthoritiesForBrokeringMain();
			} else {
				workQueueModals.populateRegionalOfficesForBrokeringMain();
			}
			workQueueModals.populateBrokerWorkItemsTableMain();
		},
		buttons: [
			{
                class: "btn btn-primary",
				text: "Cancel",
				click: function () {
					$(this).dialog("close");
					workQueueModals.resetActions();
				}
			},
			{
				id: "brokerSubmitButton",
                class: "btn btn-primary",
				text: "Submit",
				click: function () {
					$("#brokerSubmitButton").attr("disabled", "disabled");
					workQueueModals.showOverlay();
					workQueueModals.brokerWorkItemsMain();
				}
			}
		]
	});
    $("#nwqTransferClaimsModal").dialog({
        modal: true,
        autoOpen: false,
        resizable: false,
        minHeight: 0,
        width: 550,
        height: 500,
        title: '<h1>Transfer Claims</h1>',
        close: function() {
            $(this).parent().untrap();
            $("#actionSelect_wid").val("select"); // Work Item Details
            $("#select-actions").val("select"); // Work Queue Inbox

            //Clear typeahead
            $("#nwqTransferClaimsROTypeahead").val('');
            $("#nwqTransferClaimsROTypeaheadValue").val('');

            //empty workItem table:
            workQueueModals.emptyWorkItemTable($("#nwqTransferClaimsTable"));
            $("#nwqTransferClaimsListEmptyErrorPlaceholder").hide();

            //re-display work items table if it's been hidden
            $('#nwqTransferClaimsTable').show();

            $("#nwqTransferClaimsSubmitButton").removeAttr("disabled");
            $("#nwqTransferClaimsErrorDiv").hide();

            workQueueModals.resetActions();
        },
        open: function() {
            $(this).parent().trap();
            $("#nwqTransferClaimsPermanentNoteText").val(transferWorkItemDefault);
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
            workQueueModals.populateNwqTransferClaimsModal();
            workQueueModals.populateTransferLocationsForNwqTransferClaimsModal();
        },
        buttons: [
            {
                class: "btn btn-primary",
                text: "Cancel",
                click: function () {
                    $(this).dialog("close");
                    workQueueModals.resetActions();
                }
            },
            {
                id: "nwqTransferClaimsSubmitButton",
                class: "btn btn-primary",
                text: "Submit",
                click: function() {
                    $("nwqTransferClaimsSubmitButton").attr("disabled", "disabled");

                    workQueueModals.showOverlay();
                    workQueueModals.nwqTransferClaimsMain();
                }
            }
        ]
    });
	$("#changeTeamAssignmentModal").dialog({
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 550,
		height: 300,
		title: '<h1>Change Team Assignment</h1>',
		close: function () {
			$(this).parent().untrap();
			$("#actionSelect_wid").val("select"); // Work Item Details
			$("#select-actions").val("select"); // Work Queue Inbox

			//clear "Teams" SELECT control:
			$("#changeTeamAssignmentTeamsSelect")[0].options.length = 0;

			//empty workItem table:
			workQueueModals.emptyWorkItemTable($("#changeTeamAssignmentWorkItemsTable"));
			$("#changeTeamAssignmentWorkItemsError").hide();

			$("#changeTeamAssignmentSubmitButton").removeAttr("disabled");
			$("#changeTeamAssignmentErrorDiv").hide();

			$("#changeTeamAssignmentRestrictedItemsWarningDiv").hide();
			$("#changeTeamAssignmentRestrictedWorkItemIdList").empty();

            workQueueModals.resetActions();
		},
		open: function () {
			$(this).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			workQueueModals.populateTeamsForTeamAssignmentMain();
			workQueueModals.populateChangeTeamAssignmentWorkItemsTableMain();
		},
		buttons: [
            {
                id: "changeTeamAssignmentSubmitButton",
                class: "btn btn-primary",
                text: "Submit",
                click: function () {
                    $("#changeTeamAssignmentSubmitButton").attr("disabled", "disabled");

                    workQueueModals.showOverlay();
                    workQueueModals.updateTeamAssignmentForWorkItemsMain();
                }
            },
			{
                class: "btn btn-primary",
				text: "Cancel",
				click: function () {
					$(this).dialog("close");
					workQueueModals.resetActions();
				}
			}
		]
	});
    $("#exportWorkQueueToCsvModal").dialog({
        dialogClass: "no-close",
        modal: true,
        autoOpen: false,
        resizable: false,
        minHeight: 0,
        width: 450,
        height: 200,
        close: function () {
            $(this).parent().untrap();

            $("#exportWorkQueueSubmitButton").removeAttr("disabled");
            $("#exportWorkQueueToCsvErrorDiv").hide();

            workQueueModals.resetActions();
        },
        open: function () {
            $("#exportWorkQueueToCsvModal").siblings('div.ui-dialog-titlebar').remove();
            $(self).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
        },
        buttons: [
            {
                class: "btn btn-primary",
                text: "Close",
                click: function () {
                    $(this).dialog("close");
                }
            },
            {
                id: "exportWorkQueueSubmitButton",
                class: "btn btn-primary",
                text: "Go to My Exports",
                click: function () {
                    $("#exportWorkQueueSubmitButton").attr("disabled", "disabled");
                    $(this).dialog("close");
                    $('#myExports a[href="#tabs-7"]').click();
                }
            }
        ]
    });
    $("#exportWorkQueueToCsvJobRunningModal").dialog({
        dialogClass: "no-close",
        modal: true,
        autoOpen: false,
        resizable: false,
        minHeight: 0,
        width: 450,
        height: 200,
        close: function () {
            $(this).parent().untrap();

            $("#exportWorkQueueSubmitButton").removeAttr("disabled");
            $("#exportWorkQueueToCsvErrorDiv").hide();

            workQueueModals.resetActions();
        },
        open: function () {
            $("#exportWorkQueueToCsvJobRunningModal").siblings('div.ui-dialog-titlebar').remove();
            $(self).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
        },
        buttons: [
            {
                class: "btn btn-primary",
                text: "Close",
                click: function () {
                    $(this).dialog("close");
                }
            },
            {
                id: "exportWorkQueueSubmitButton",
                class: "btn btn-primary",
                text: "Go to My Exports",
                click: function () {
                    $("#exportWorkQueueSubmitButton").attr("disabled", "disabled");
                    $(this).dialog("close");
                    $('#myExports a[href="#tabs-7"]').click();
                }
            }
        ]
    });
    $("#exportFailureDetailsDialogModal").dialog({
        modal: true,
        autoOpen: false,
        resizable: false,
        minHeight: 0,
        width: 400,
        height: 200,
        title: '<h1>Export Failure Details</h1>',
        open: function() {
            $(this).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
            $(".ui-dialog-titlebar-close").hide();
            var message = $('#exportFailureDetailsWarningMessage').html();
            message = message.substring(0, message.lastIndexOf(":") + 1);
            message = message + "<br>" + $(this).data("errorId");
            $('#exportFailureDetailsWarningMessage').html(message);
        },
        buttons: [
            {
                class: "btn btn-primary",
                text: "Close",
                click: function () {
                    $(this).dialog("close");
                    workQueueModals.resetActions();
                }
            }
        ]
    });
	$("#removePendingDialogModal").dialog({
		modal: true,
		autoOpen: false,
		resizable: false,
		minHeight: 0,
		width: 400,
		height: 200,
		title: '<h1>Remove Pending Upload Indicator</h1>',
		open: function() {
			$(this).parent().trap();
			$(this).parent().focus(); //ADDED IN VBMSD-77221 For Focus Of Modal - 508 Compliance - Focus for JAWS Support
			var message = $('#pendingUploadRemoveWarningMessage').html();
			message = message.substring(0, message.lastIndexOf(":") + 1);
			message = message + $(this).data("fileNumber");
			$('#pendingUploadRemoveWarningMessage').html(message);
		},
		buttons: [
			{
				text: "No",
				click: function(){
					$(this).find('#requiredError').css('display', 'none');
					$(this).dialog("close");
				}
			},
			{
				text:"Yes",
				click: function(){
					if(window.console) {
						console.log("in submit :" + $(this).data("fileNumber"));
					}
					removePendingUploadIndicator($(this).data("fileNumber"));
				}
			}
		]
	});

	//setting tabindex for wrapper divs, IE7 thinks that they are valid in the tabbing sequence
	$(".ui-dialog").find("div:not(:first)").each(function () {
		$(this).attr("tabindex", "-1")
	});

	/*
	 *********************************
	 * Error Close Message Functions *
	 *********************************
	 */
	$("#completeErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			$("#completeSubmitButton").removeAttr("disabled");
			$("#completeErrorDiv").hide();
		}
	});
	$("#reassignErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			//check to make sure we have workItems before we reenable the submit button
			var visibleNoWorkItemError = $("#reassignWorkItemsError").is(":visible")
			if (visibleNoWorkItemError != true) {
				//unlock submit box
				$("#reassignSubmitButton").removeAttr("disabled");
			}
			$("#reassignErrorDiv").hide();
		}
	});
	$("#unassignErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			$("#unassignSubmitButton").removeAttr("disabled");
			$("#unassignErrorDiv").hide();
		}
	});
	$("#updatePriorityErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			//check to make sure we still have workItems before we unlock the Submitbutton
			var visibleNoWorkItemError = $("#updatePriorityWorkItemsError").is(":visible")
			if (visibleNoWorkItemError != true) {
				//unlock submit box
				$("#updatePrioritySubmitButton").removeAttr("disabled");
			}
			$("#updatePriorityErrorDiv").hide();
		}
	});
	$("#assignToMeErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			$("#assignToMeSubmitButton").removeAttr("disabled");
			$("#assignToMeErrorDiv").hide();
		}
	});
	$("#brokerErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			$("#brokerSubmitButton").removeAttr("disabled");
			$("#brokerErrorDiv").hide();
		}
	});
    $("#nwqTransferClaimsErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			$("#nwqTransferClaimsSubmitButton").removeAttr("disabled");
			$("#nwqTransferClaimsErrorDiv").hide();
		}
    });
	$("#changeTeamAssignmentErrorCloseMessage").on('click keypress', function (e) {
		if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
			$("#changeTeamAssignmentSubmitButton").removeAttr("disabled");
			$("#changeTeamAssignmentErrorDiv").hide();
		}
	});
    $("#exportWorkQueueToCsvErrorCloseMessage").on('click keypress', function (e) {
        if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
            $("#exportWorkQueueSubmitButton").removeAttr("disabled");
            $("#exportWorkQueueToCsvErrorDiv").hide();
        }
    });
    $("#exportFailureDetailsCloseMessage").on('click keypress', function (e) {
        if (e.type === 'click' || e.which === 13 || e.which === 32) { // Enter key = 13, Spacebar = 32
            $("#exportFailureDetailsErrorDiv").hide();
        }
    });
	$("#removePendingErrorCloseMessage").click(function () {
		$("#removePendingErrorDiv").hide();
	});

	/*
	 ************************
	 * Note Click Functions *
	 ************************
	 */

	$("#completeNote").focus(function () {
		if ($(this).val() == completeNoteDefault) {
			$(this).val('');
		}
	});
	$("#reassignNote").focus(function () {
		if ($(this).val() == reassignNoteDefault) {
			$(this).val('');
		}
	});
	$("#unassignNote").focus(function () {
		if ($(this).val() == unassignNoteDefault) {
			$(this).val('');
		}
	});
	$("#brokerNote").focus(function () {
		if ($(this).val() == brokerNoteDefault) {
			$(this).val('');
		}
	});
    $("#nwqTransferClaimsPermanentNoteText").focus(function () {
        if($(this).val() == transferWorkItemDefault) {
            $(this).val('');
        }
    });

    $('button[id="nwqTransferClaimsROTypeaheadViewButton"]').button({
        icons: {
            primary: "ui-icon ui-icon-triangle-1-s"
        },
        text: false
    });
    $("#nwqTransferClaimsROTypeaheadViewButton").unbind("click").click(function () {
        var searchVal = $("#nwqTransferClaimsROTypeahead").val();
        if ($("#nwqTransferClaimsROTypeahead").autocomplete('widget').is(':visible')) {
            $("#nwqTransferClaimsROTypeahead").autocomplete('close');
            return;
        }
        $("#nwqTransferClaimsROTypeahead").autocomplete("search", "");
        $("#nwqTransferClaimsROTypeahead").focus();
    });
	$('button[id="reassignClaimAuthorityTypeaheadViewButton"]').button({
		icons: {
			primary: "ui-icon ui-icon-triangle-1-s"
		},
		text: false
	});
	$("#reassignClaimAuthorityTypeaheadViewButton").unbind("click").click(function () {
		var searchVal = $("#reassignClaimAuthorityTypeahead").val();
		if ($("#reassignClaimAuthorityTypeahead").autocomplete('widget').is(':visible')) {
			$("#reassignClaimAuthorityTypeahead").autocomplete('close');
			return;
		}
		$("#reassignClaimAuthorityTypeahead").autocomplete("search", "");
		$("#reassignClaimAuthorityTypeahead").focus();
	});
	$("#claimAuthoritiesTypeaheadViewButton").unbind("click").click(function () {
		var searchVal = $("#claimAuthoritiesTypeahead").val();
		if ($("#claimAuthoritiesTypeahead").autocomplete('widget').is(':visible')) {
			$("#claimAuthoritiesTypeahead").autocomplete('close');
			return;
		}
		$("#claimAuthoritiesTypeahead").autocomplete("search", "");
		$("#claimAuthoritiesTypeahead").focus();
	});
	$("#completeWorkItemClaimLocationTypeaheadViewButton").unbind("click").click(function () {
		var searchVal = $("#completeWorkItemClaimLocationTypeahead").val();
		if ($("#completeWorkItemClaimLocationTypeahead").autocomplete('widget').is(':visible')) {
			$("#completeWorkItemClaimLocationTypeahead").autocomplete('close');
			return;
		}
		$("#completeWorkItemClaimLocationTypeahead").autocomplete("search", "");
		$("#completeWorkItemClaimLocationTypeahead").focus();
	});

	/*
	 **********************
	 * Dropdown Functions *
	 **********************
	 */

	/* Fix for VBMSD-145533 and VBMSD-146697, unbinding event hooks before binding prevents double binding.
    This entire section of code is being called twice. Can be removed when a general fix for that is found.
 */
	$('select#reassignUsersSelect').unbind('change').on('change', function () {
		workQueueModals.toggleTeamsForReassign();
		workQueueModals.findAndFlagPendingDeferralWorkItemsForReassign();
	});
	$('select#reassignTeamsSelect').unbind('change').on('change', workQueueModals.toggleUsersForReassign);

	$('#completionClaimStatusesSelect').unbind('change').on('change', workQueueModals.toggleCompletionLists);
	// Fix for VBMSD-130180, fix team name randomly dropping due to a timeout issue.
	$('#completeUsersSelect').unbind('change').on('change', function() {
		workQueueModals.toggleTeamsForComplete();
		workQueueModals.showHideUnassignedUserWarning();
	});

	/*
	 ***********************
	 * Typeahead Functions *
	 ***********************
	 */

	$('#completeWorkItemClaimLocationTypeahead').on('focus', setOriginalValue);
	$('#reassignClaimAuthorityTypeahead').on('focus', setOriginalValue);
	$('#claimAuthoritiesTypeahead').on('focus', setOriginalValue);
	$('#nwqTransferClaimsROTypeahead').on('focus', setOriginalValue);

	/*
	 **********************************
	 * Supplemental EP Code Functions *
	 **********************************
	 */

	$('.supplementalEpCodeClaimLabel').on('click', function (event) {
		var $item = $(event.currentTarget);
		var filenumber = $item.data('fileNumber');
		var claimId = $item.data('claimId');
		postVbmsDefaultFormToNewWindow(
			'claimDetail',
			{'fileNumber':filenumber,'claimID':claimId},
			null);
	});
});

function setOriginalValue(event) {
	event.currentTarget.originalvalue = event.currentTarget.value;
}


function checkForValidLocation(locationsLabelsList, locationValue) {
    var listLength = locationsLabelsList.length;
    var matchFound = false;

    for(var i = 0; i < listLength; i++) {
        var currentValue = locationsLabelsList[i];
        if((locationValue == currentValue) && (matchFound == false)) {
            matchFound = true;
            break;
        }
    }

    return matchFound;
}
function setupNwqTransferClaimsTypeahead(locationList) {
    $("#nwqTransferClaimsROTypeahead").autocomplete({
		//Defect #317540, A.Armstrong set autoFocus to false for 508 compliance.
        source: locationList,
        minLength: 0,
        focus: function(event, ui) {
            // prevent autocomplete from updating the textbox
            event.preventDefault();
            // manually update the textbox and hidden field
            $(this).val(ui.item.label);
            $("#nwqTransferClaimsROTypeaheadValue").val(ui.item.value);

        },
        handleChange: function(event, ui) {

            var sourceOptions = $('#nwqTransferClaimsROTypeahead').autocomplete("option").source;
            var inputTextValue = $('#nwqTransferClaimsROTypeahead').val();
            // if label text has been cleared out, clear out hidden value field, else match it
            if (inputTextValue == null || inputTextValue.length < 1) {
                $("#nwqTransferClaimsROTypeaheadValue").val("");
            } else {
                for (var i = 0; i < sourceOptions.length; i++) {
                    if (sourceOptions[i].label && sourceOptions[i].label == inputTextValue) {
                        $("#nwqTransferClaimsROTypeaheadValue").val(sourceOptions[i].value);
                        break;
                    }
                }
            }

            var locationSelected = $("#nwqTransferClaimsROTypeahead").val();
            var nwqTransferClaimsTooltip = $("#nwqTransferClaimsTooltip");
            var nwqTransferClaimsTooltipDiv = $("#nwqTransferClaimsTooltipDiv");

            switch(locationSelected) {
                case 'Pension Management Center':
                    nwqTransferClaimsTooltip.html('Selecting this option will transfer ' +
                        'all selected claims to each Veteran\'s Pension Management Center');
                    nwqTransferClaimsTooltipDiv.show();
                    break;
                case 'Veteran Local Regional Office':
                    nwqTransferClaimsTooltip.html('Selecting this option will transfer ' +
                        'all selected claims to each Veteran\'s local Regional Office');
                    nwqTransferClaimsTooltipDiv.show();
                    break;
                case 'Claim Establishment Regional Office':
                    nwqTransferClaimsTooltip.html('Selecting this option will transfer ' +
                        'all selected claims to the Regional Office in which the claim was established');
                    nwqTransferClaimsTooltipDiv.show();
                    break;
                default:
                    nwqTransferClaimsTooltipDiv.hide();
                    break;
            }

        },
        select: function(event, ui) {
            // prevent autocomplete from updating the textbox
            event.preventDefault();
            // manually update the textbox and hidden field
            $(this).val(ui.item.label);
            $("#nwqTransferClaimsROTypeaheadValue").val(ui.item.value);

            var locationSelected = ui.item.value;

            var nwqTransferClaimsTooltip = $('#nwqTransferClaimsTooltip');
            var nwqTransferClaimsTooltipDiv = $('#nwqTransferClaimsTooltipDiv');

            switch(locationSelected) {
                case 'Pension Management Center':
                    nwqTransferClaimsTooltip.html('Selecting this option will transfer ' +
                        'all selected claims to each Veteran\'s Pension Management Center');
                    nwqTransferClaimsTooltipDiv.show();
                    break;
                case 'Veteran Local Regional Office':
                    nwqTransferClaimsTooltip.html('Selecting this option will transfer ' +
                        'all selected claims to each Veteran\'s local Regional Office');
                    nwqTransferClaimsTooltipDiv.show();
                    break;
                case 'Claim Establishment Regional Office':
                    nwqTransferClaimsTooltip.html('Selecting this option will transfer ' +
                        'all selected claims to the Regional Office in which the claim was established');
                    nwqTransferClaimsTooltipDiv.show();
                    break;
                default:
                    nwqTransferClaimsTooltipDiv.hide();
                    break;
            }
        }
    });

    $("#nwqTransferClaimsROTypeahead").on("autocompletechange", function(event,ui) {
        $("#nwqTransferClaimsROTypeahead").data("autocomplete")._trigger("handleChange");
    });
}
function setupReassignClaimsTypeahead(locationList) {
	$("#reassignClaimAuthorityTypeahead").autocomplete({
		source: locationList,
		minLength: 0,
		create: function( event, ui ) {
			var ro = getROFromLocationList(locationList);
			$("#reassignClaimAuthorityTypeaheadValue").val(ro.value);
			$('#reassignClaimAuthorityTypeahead').val(ro.label);
			$("#reassignClaimAuthorityTypeaheadViewButton").show();

			function getROFromLocationList(locationList) {
				for (var i in locationList) {
					var location = locationList[i];
					if (location.value < 1000) {
						return location;
					}
				}
			}
		},
		focus: function(event, ui) {
			// prevent autocomplete from updating the textbox
			event.preventDefault();
			// manually update the textbox and hidden field
			$(this).val(ui.item.label);
			$("#reassignClaimAuthorityTypeaheadValue").val(ui.item.value);

		},
		handleChange: function(event, ui) {

			var sourceOptions = $('#reassignClaimAuthorityTypeahead').autocomplete("option").source;
			var inputTextValue = $('#reassignClaimAuthorityTypeahead').val();
			// if label text has been cleared out, clear out hidden value field, else match it
			if (inputTextValue == null || inputTextValue.length < 1) {
				$("#reassignClaimAuthorityTypeaheadValue").val("");
			} else {
				for (var i = 0; i < sourceOptions.length; i++) {
					if (sourceOptions[i].label && sourceOptions[i].label == inputTextValue) {
						$("#reassignClaimAuthorityTypeaheadValue").val(sourceOptions[i].value);
						break;
					}
				}
			}

			var locationSelected = $("#reassignClaimAuthorityTypeahead").val();
			var reassignClaimsTooltip = $("#reassignClaimsTooltip");
			var reassignClaimsTooltipDiv = $("#reassignClaimsTooltipDiv");
			reassignClaimsTooltipDiv.hide();

		},
		select: function(event, ui) {
			// prevent autocomplete from updating the textbox
			event.preventDefault();
			// manually update the textbox and hidden field
			$(this).val(ui.item.label);
			$("#reassignClaimAuthorityTypeaheadValue").val(ui.item.value);
			var reassignClaimsTooltipDiv = $('#reassignClaimsTooltipDiv');
			reassignClaimsTooltipDiv.hide();
		}
	});

	$("#reassignClaimAuthorityTypeahead").on("autocompletechange", function(event,ui) {
		$("#reassignClaimAuthorityTypeahead").data("autocomplete")._trigger("handleChange");
	});
}
function setupClaimAuthoritiesTypeahead(locationList) {
	$("#claimAuthoritiesTypeahead").autocomplete({
		source: locationList,
		minLength: 0,
		focus: function(event, ui) {
			// prevent autocomplete from updating the textbox
			event.preventDefault();
			// manually update the textbox and hidden field
			$(this).val(ui.item.label);
			$("#claimAuthoritiesTypeaheadValue").val(ui.item.value);
		},
		handleChange: function(event, ui) {
			var sourceOptions = $('#claimAuthoritiesTypeahead').autocomplete("option").source;
			var inputTextValue = $('#claimAuthoritiesTypeahead').val();
			// if label text has been cleared out, clear out hidden value field, else match it
			if (inputTextValue == null || inputTextValue.length < 1) {
				$("#claimAuthoritiesTypeaheadValue").val("");
			} else {
				for (var i = 0; i < sourceOptions.length; i++) {
					if (sourceOptions[i].label && sourceOptions[i].label == inputTextValue) {
						$("#claimAuthoritiesTypeaheadValue").val(sourceOptions[i].value);
						break;
					}
				}
			}
		},
		select: function(event, ui) {
			// prevent autocomplete from updating the textbox
			event.preventDefault();
			// manually update the textbox and hidden field
			$(this).val(ui.item.label);
			$("#claimAuthoritiesTypeaheadValue").val(ui.item.value);
		}
	});

	$("#claimAuthoritiesTypeahead").on("autocompletechange", function(event,ui) {
		$("#claimAuthoritiesTypeahead").data("autocomplete")._trigger("handleChange");
	});
}

function setupCompleteWorkItemClaimLocationTypeahead(locationList) {
	$("#completeWorkItemClaimLocationTypeahead").autocomplete({
		source: locationList,
		minLength: 0,
		focus: function(event, ui) {
			// prevent autocomplete from updating the textbox
			event.preventDefault();
			// manually update the textbox and hidden field
			$(this).val(ui.item.label);
			$("#completeWorkItemClaimLocationTypeaheadValue").val(ui.item.value);
		},
		handleChange: function(event, ui) {
			var sourceOptions = $('#completeWorkItemClaimLocationTypeahead').autocomplete("option").source;
			var inputTextValue = $('#completeWorkItemClaimLocationTypeahead').val();
			// if label text has been cleared out, clear out hidden value field, else match it
			if (inputTextValue == null || inputTextValue.length < 1) {
				$("#completeWorkItemClaimLocationTypeahead").val("");
			} else {
				for (var i = 0; i < sourceOptions.length; i++) {
					if (sourceOptions[i].label && sourceOptions[i].label == inputTextValue) {
						$("#completeWorkItemClaimLocationTypeaheadValue").val(sourceOptions[i].value);
						break;
					}
				}
			}
		},
		select: function(event, ui) {
			// prevent autocomplete from updating the textbox
			event.preventDefault();
			// manually update the textbox and hidden field
			$(this).val(ui.item.label);
			$("#completeWorkItemClaimLocationTypeaheadValue").val(ui.item.value);
		}
	}).data('autocomplete')._trigger("select", this, {item: locationList[0]});

	$("#completeWorkItemClaimLocationTypeahead").on("autocompletechange", function(event,ui) {
		$("#completeWorkItemClaimLocationTypeahead").data("autocomplete")._trigger("handleChange");
	});
}


var workQueueModals = {

	/* Records how many times a modal was submitted */
    submissions: 0,

    ajaxSuccess: function (ajaxResponse, successFunction, isRedirect, dialog, errorPlaceholder, errorDiv) {

        $("#completeSubmitButton").removeAttr("disabled");

        var wasSuccess = ajaxResponse['success'];
        if (wasSuccess) {
            if (isRedirect) {
                successFunction(dialog, ajaxResponse['data']);
                //create a cookie to store displayMessage and messageType
                document.cookie = "displayMessage" + "=" + ajaxResponse['data'];
                document.cookie = "messageType=success";
            } else {
                successFunction(ajaxResponse);
            }
        } else {

            var holdErrors = ajaxResponse['errors']; //errors holds a java MAP..
            var keys = $.map(holdErrors, function (value, index) {
                return index;
            });
            if (keys == null || keys.length <= 0) {
                errorPlaceholder.html(ajaxResponse['errorHtml']);
            } else {
                var errorList = "";
                $.each(keys, function (key, value) {
                    errorList += holdErrors[value];
                    errorList += "<br>"
                });
                errorPlaceholder.html(errorList);
            }
			if($("#promptUserOpenESR").dialog('isOpen') === true){
				$("#promptUserOpenESR").dialog('close');
			}
            errorDiv.show();
            workQueueModals.removeOverlay();
        }
    },
    ajaxError: function (jqXHR, textStatus, errorThrown, errorPlaceholder, errorDiv, errorFunction) {
        $("#completeSubmitButton").removeAttr("disabled");

        if (vbmsMain.shouldAlertAjaxError(jqXHR, textStatus)) {
            var errorHTML = '<<< error:  ' + textStatus + ' exception: ' + errorThrown + '>>>';
            errorPlaceholder.html(errorHTML);
            errorDiv.show();
        }

        workQueueModals.removeOverlay();

        errorFunction();
    },

    /**
     * Custom ajax handler for reassignWorkItems. This custom behavior is part of story 635597
     */
    ajaxReassignWorkItems: function (response, successFunction, isRedirect, dialog, warningDiv, user) {

        workQueueModals.removeOverlay();
        $("#completeSubmitButton").removeAttr("disabled");

        /*
     		Calling handleFilterButtonClick fixes both VBMSD-72205 and VBMSD-54180/Defect 684909 by forcing a save of the filter,
     		but only on reassign so not to introduce latency when the Work Queue is loaded.
         */
		if( typeof workQueueFilter !== 'undefined' ) {
			workQueueFilter.handleFilterButtonClick();
		}

        if (!response.errors) {
            var msg = 'Successfully reassigned ' + sanitizeResponseValues(response.totalWorkItemCount, "number") + ' work items';
            successFunction(dialog, msg);
            document.cookie = 'displayMessage=' + msg;
            document.cookie = 'messageType=success';
        } else {
            // parse username out of the parenthesis
            var username = user.username.replace(/^.*\((.*)\).*/, '$1');

            // build warning message
            var failedCount = response.totalWorkItemCount - response.successfulWorkItemCount;
            var warningMessage = warningDiv.find("p:first");
            warningMessage.empty();
            var messageText = "Warning: " + failedCount + " of " + response.totalWorkItemCount
                + " selected work items were not able to be assigned to "
                + username
                + " due to security restrictions. \n \n";
            warningMessage.text(messageText);

            var fileNumbers = [];
            $.each(response.errorItems, function (idx, item) {
                fileNumbers.push(item.fileNumber);
            });

            warningMessage.append(fileNumbers.join(", "));

            var $parent = dialog.closest(".ui-dialog");
            var $titlebarCloseButton = $(".ui-dialog-titlebar-close", $parent);

            var $submitButton = $(".ui-dialog-buttonset button[disabled]", $parent);
            $submitButton.hide();

            var $cancelButton = $(".ui-dialog-buttonset button:not([disabled])", $parent);
            $cancelButton.html("Close");

            var closeHandler = function (event) {
                var msg = "Successfully reassigned " + sanitizeResponseValues(response.successfulWorkItemCount, "number") + " of " + sanitizeResponseValues(response.totalWorkItemCount, "number") + " work items";
                $(".form-content", dialog).show();
                successFunction(dialog, msg);
                if (response.successfulWorkItemCount > 0) {
                    document.cookie = 'displayMessage=' + msg;
                    document.cookie = 'messageType=success';
                }
            }

            $titlebarCloseButton.click(closeHandler);
            $cancelButton.click(closeHandler);

            $(".form-content", dialog).hide();
            warningDiv.show();
        }
    },

    resetActions: function () {

        //assuming that the actions are the work queue actions
        var wqAction = $('#select-actions').find('option');  //work queue actions
        var wdAction = $('#actionSelect_wid').find('option'); //work item detail actions

        if (wqAction !== null && wqAction.length !== 0) {
            workQueueModals.updateSelection(wqAction, '');
        } else {
            workQueueModals.updateSelection(wdAction, 'select');
        }
    },
    updateSelection: function (option, value) {
        for (var i = 0; i < option.length; i++) {
            var thisOption = option[i];
            var text = thisOption.value;
            thisOption.selected = (text == value);
        }
    },

    showHideUnassignedUserWarning: function () {
        if ($("#completeUsersSelect").val() == unassignedUserValue) {
            $("#unassignedUserWarning").show();
        } else {
            $("#unassignedUserWarning").hide();
        }
    },

    toggleCompletionLists: function () {

        $("#unassignedUserWarning").hide();

        var claimStatus = $("#completionClaimStatusesSelect");
        var closeWorkItemReasons = $("#closeWorkItemReasonsSelect");
        var completeUser = $("#completeUsersSelect");
        var completeTeam = $("#completeTeamsSelect");
        var validLocations = $("#completeWorkItemClaimLocationTypeahead");

        var claimStatusVal = claimStatus.val();

        if (claimStatusVal === unselectedOptionValue) {
            // Disable closeWorkItemReasons SELECT control and selectedUser SELECT control

            workQueueModals.disableElement(closeWorkItemReasons);
            workQueueModals.disableElement(completeUser);
            workQueueModals.disableElement(completeTeam);
            workQueueModals.disableElement(validLocations);
        } else if ((claimStatusVal == 'CLOSED') || (claimStatusVal == 'CANCELLED')) {
            // Populate closeWorkItemReasons SELECT control, enable it, and disable selectedUser SELECT control

            workQueueModals.populateClaimCloseReasonsMain(claimStatusVal);

            workQueueModals.enableElement(closeWorkItemReasons, unselectedOptionValue);
            workQueueModals.disableElement(completeUser);
            workQueueModals.disableElement(completeTeam);
            workQueueModals.disableElement(validLocations);
        } else {
            $("#completeSubmitButton").attr("disabled", true);

            // Populate selectedUser SELECT control, enable it, and disable closeWorkItemReasons SELECT control

            var workItemId;
            if (typeof workItemDetails !== 'undefined') {
                workItemId = workItemDetails.getDetailWorkItemId();
            }
            else if (typeof claimDetail !== 'undefined') {
                workItemId = claimDetail.getDetailWorkItemId();
            }

            workQueueModals.populateUsersForCompletionMain(workItemId, claimStatusVal);

            workQueueModals.enableElement(completeUser, unassignedUserValue);
            workQueueModals.disableElement(closeWorkItemReasons);
			workQueueModals.enableElement(validLocations);
			workQueueModals.populateCompleteWorkItemModalTypeaheadMain();
            $("#completeSubmitButton").attr("disabled", false);
        }
    },

    toggleTeamsForReassign: function () {

        var reassignTeams = $("#reassignTeamsSelect");
        var teamReassignVal = reassignTeams.val();

        var reassignUser = $("#reassignUsersSelect");
        var reassignUserVal = reassignUser.val();

        //if the user and team is reset to unassigned, populate the non-filtered content.
        if (teamReassignVal == 'NONE' && reassignUserVal == 'NONE') {
            //clear "Users" SELECT control
            reassignUser[0].options.length = 0;
            workQueueModals.populateUsersForReassignMain(teamReassignVal);

            //clear "Teams" SELECT control:
            reassignTeams[0].options.length = 0;

            workQueueModals.populateTeamsForReassignMain(reassignUserVal);
        }
        else {
            //clear "Teams" SELECT control:
            reassignTeams[0].options.length = 0;
            workQueueModals.populateTeamsForReassignMain(teamReassignVal);
        }


    },

    toggleTeamsForComplete: function () {

        var completeTeams = $("#completeTeamsSelect");

        var completeUser = $("#completeUsersSelect");
        var completeUserVal = completeUser.val();

        //if the user is reset to unassigned, remove teams and disable element.
        if (completeUserVal == 'NONE') {
            //clear "Teams" SELECT control:
            completeTeams[0].options.length = 0;

            workQueueModals.disableElement(completeTeams);
        }
        else {
            //clear "Teams" SELECT control:
            completeTeams[0].options.length = 0;
            workQueueModals.populateTeamsForCompleteMain();

            workQueueModals.enableElement(completeTeams);

        }


    },

    toggleUsersForReassign: function () {

        var reassignUser = $("#reassignUsersSelect");
        var teamReassign = $("#reassignTeamsSelect");

        var teamSelectedVal = teamReassign.val();
        var userSelectedVal = reassignUser.val();

        //if the team is reset to unassigned get all the users and team again
        if (teamSelectedVal == 'NONE') {
            //clear "Users" SELECT control, but only when the "None" is selected
            //this is to preserve the user choice if the user has selected a user value already
            if (userSelectedVal == 'NONE') {
                reassignUser[0].options.length = 0;
            }
            workQueueModals.populateUsersForReassignMain(userSelectedVal);

            //clear "Teams" SELECT control:
            teamReassign[0].options.length = 0;
            workQueueModals.populateTeamsForReassignMain(teamSelectedVal);

        }
        //update the user group if a team is selected
        else if (teamSelectedVal != null && teamSelectedVal != 'NONE') {
            //Grab the user that may or may not be selected to keep that selection
            //We want to select that value again if the user already selected a user and they are on the new team
            //clear "Users" SELECT control
            reassignUser[0].options.length = 0;
            workQueueModals.populateUsersForReassignMain(userSelectedVal);
        }

    },

    /**
     * Replaces contents of existing span (intended to close the modal) with 'Dismiss'
     *
     * @param dialog            reference to the dialog content of the modal
     * @param buttonText        span content (intended to close the modal) to search for
     */
    toggleDismissButton: function (dialog, buttonText) {
        this.submissions++;
        $(dialog).parents('div').find(".ui-button-text:contains('" + buttonText + "')").text('Dismiss');
    },
    reloadWorkQueueIfSubmitted: function () {
        if (this.submissions > 0) this.reloadWorkQueueInbox();
    },
    resetSubmissionCounter: function () {
        this.submissions = 0;
    },

    completeWorkItemMain: function () {

        var completeSubmitButton = $("#completeSubmitButton");
        completeSubmitButton.attr("disabled", "disabled");

        var claimStatus = $("#completionClaimStatusesSelect");
        var completeNote = $("#completeNote");

        var claimStatusVal = claimStatus.val();
        var completeNoteVal = completeNote.val();

        var workItemId;
        var workItemFileNumber;

        if (typeof workItemDetails !== 'undefined') {
            workItemId = workItemDetails.getDetailWorkItemId();
            workItemFileNumber = workItemDetails.getDetailWorkItemFileNumber();
        }
        else if (typeof claimDetail !== 'undefined') {
            workItemId = claimDetail.getDetailWorkItemId();
            workItemFileNumber = claimDetail.getDetailWorkItemFileNumber();
        }

        var noteValidationError = workQueueModals.isEmptyNote(completeNoteVal, "completeNote");

        if (claimStatusVal == "SELECT") {
            completeSubmitButton.removeAttr("disabled");

            $("#completeErrorPlaceholder").html("Please select a state.");
            $("#completeErrorDiv").show();
            workQueueModals.removeOverlay();
        } else if (noteValidationError != null) {

            completeSubmitButton.removeAttr("disabled");

            $("#completeErrorPlaceholder").html(noteValidationError);
            $("#completeErrorDiv").show();
            workQueueModals.removeOverlay();
        } else if (claimStatusVal == null || claimStatusVal == unselectedOptionValue) {
            //Give the proper error for a missing claim state
            completeSubmitButton.removeAttr("disabled");

            $("#completeErrorPlaceholder").html("Please select a Claim State.");
            $("#completeErrorDiv").show();
            workQueueModals.removeOverlay();

        } else if ((claimStatusVal == 'CLOSED') || (claimStatusVal == 'CANCELLED')) {

            var closeWorkItemReasonVal = $("#closeWorkItemReasonsSelect").val();

            if (closeWorkItemReasonVal === unselectedOptionValue) {
                completeSubmitButton.removeAttr("disabled");

                $("#completeErrorPlaceholder").html("Please select a reason.");
                $("#completeErrorDiv").show();
                workQueueModals.removeOverlay();
            } else {
                var $additionalClaimCheckboxes = $(".completeSupplementalEpCheckbox:checked");
                var additionalClaims = [];

                for (var i = 0; i < $additionalClaimCheckboxes.length; i++) {
                    var $claim = $($additionalClaimCheckboxes[i]);

                    var id = $claim.attr("id");
                    additionalClaims.push(id);
                }

                closeWorkItem(workItemId,
                    workItemFileNumber,
                    claimStatusVal,
                    closeWorkItemReasonVal,
                    completeNoteVal,
					additionalClaims);
            }
        } else {

            var completeUserVal = $("#completeUsersSelect").val();
            var completeTeamVal = $("#completeTeamsSelect").val();

            //defect 248792
            //if the team is null, its sending "" to the controller which is never caught...
            if (completeTeamVal == null) {
                completeTeamVal = "NONE";
            }

            var $additionalClaimCheckboxes = $(".completeSupplementalEpCheckbox:checked");
            var additionalClaims = [];

            for (var i = 0; i < $additionalClaimCheckboxes.length; i++) {
                var $claim = $($additionalClaimCheckboxes[i]);

                var id = $claim.attr("id");
                additionalClaims.push(id);
            }

            var completeLocationVal = $("#completeWorkItemClaimLocationTypeaheadValue").val();

            completeWorkItem(workItemId,
                workItemFileNumber,
                claimStatusVal,
                completeUserVal,
                completeTeamVal,
                completeNoteVal,
				additionalClaims,
				completeLocationVal);
        }
    },

	checkFormErrorBeforePrompt: function () {

    	var error = false;

		var claimStatus = $("#completionClaimStatusesSelect");
		var claimStatusVal = claimStatus.val();

		var completeNote = $("#completeNote");
		var completeNoteVal = completeNote.val();
		var noteValidationError = workQueueModals.isEmptyNote(completeNoteVal, "completeNote");

		if (noteValidationError != null) {
			error = true;

		} else if ((claimStatusVal == 'CLOSED') || (claimStatusVal == 'CANCELLED')) {
			var closeWorkItemReasonVal = $("#closeWorkItemReasonsSelect").val();

			if (closeWorkItemReasonVal === unselectedOptionValue) {
				error = true;
			}
		}
		return error;
	},

    reassignWorkItemMain: function () {

        var reassignSubmitButton = $("#reassignSubmitButton");
        reassignSubmitButton.attr("disabled", "disabled");

        var reassignUser = $("#reassignUsersSelect");
        var reassignTeam = $("#reassignTeamsSelect");

        var reassignNote = $("#reassignNote");


        var reassignUserVal = reassignUser.val();
        var reassignTeamVal = reassignTeam.val();
		var reassignClaimAuthorityVal = $("#reassignClaimAuthorityTypeaheadValue").val();
        var reassignNoteVal = reassignNote.val();

		var reassignSpecialMission = null;

        if (typeof reassignClaimAuthorityVal !== 'number' && reassignClaimAuthorityVal > 1000) {//filter out ro for reassign since the claim is already there
			reassignSpecialMission = reassignClaimAuthorityVal;
		}


        var isUnassignedUser = reassignUserVal === unassignedUserValue;
        var isUnassignedTeam = reassignTeamVal === unassignedTeamValue;
        var noteValidationError = workQueueModals.isEmptyNote(reassignNoteVal, "reassignNote");

        if (noteValidationError != null) {
            reassignSubmitButton.removeAttr("disabled");

            $("#reassignErrorPlaceholder").html(noteValidationError);
            $("#reassignErrorDiv").show();
            workQueueModals.removeOverlay();
        } else {

            var reassignUserName = null;
            if (reassignUserVal === unassignedUserValue) {
                reassignUserVal = null;
            } else {
                var results = $("option[value=" + reassignUserVal + "]", reassignUser);
                if (results.length > 0) {
                    reassignUserName = results.text();
                }
            }

            if (reassignTeamVal === unassignedTeamValue) {
                reassignTeamVal = null;
            }

            var workItemIds = workQueueModals.getWorkItemIds();
            var reassignPriority = $("#reassignPrioritySelect").val();

            if (reassignPriority === unselectedOptionValue) {
                reassignPriority = null;
            }

            reassignWorkItems(workItemIds, reassignNoteVal, reassignPriority, reassignSpecialMission, reassignTeamVal, reassignUserVal, reassignUserName);
        }
    },


    unassignWorkItemMain: function () {


        var unassignSubmitButton = $("#unassignSubmitButton");
        unassignSubmitButton.attr("disabled", "disabled");

        var unassignNote = $("#unassignNote");
        var unassignNoteVal = unassignNote.val();

        var noteValidationError = workQueueModals.isEmptyNote(unassignNoteVal, "unassignNote");

        if (noteValidationError != null) {
            unassignSubmitButton.removeAttr("disabled");

            $("#unassignErrorPlaceholder").html(noteValidationError);
            $("#unassignErrorDiv").show();
            workQueueModals.removeOverlay();
        } else {

            var workItemIds = workQueueModals.getWorkItemIds();
            var unassignPriority = $("#unassignPrioritySelect").val();

            if (unassignPriority === unselectedOptionValue) {
                unassignPriority = null;
            }

            unassignWorkItems(
                workItemIds,
                unassignNoteVal,
                unassignPriority);
        }
    },

    updatePriorityForWorkItemMain: function () {

        var updatePrioritySubmitButton = $("#updatePrioritySubmitButton");
        updatePrioritySubmitButton.attr("disabled", "disabled");

        var workItemIds = workQueueModals.getWorkItemIds();
        var priorityVal = $("#prioritySelect").val();

        if (priorityVal == unselectedOptionValue) {
            updatePrioritySubmitButton.removeAttr("disabled");

            $("#updatePriorityErrorPlaceholder").html("Please select a priority.");
            $("#updatePriorityErrorDiv").show();
            workQueueModals.removeOverlay();
        } else {
            updatePriorityForWorkItems(workItemIds, priorityVal);
        }
    },

    assignWorkItemToMeMain: function () {

        var assignToMeSubmitButton = $("#assignToMeSubmitButton");
        assignToMeSubmitButton.attr("disabled", "disabled");

        var workItemIds = workQueueModals.getWorkItemIds();
        var assignToMeTeamVal = $("#assignToMeTeamsSelect").val();

        //if unasssigned is selected for team, set to null, which will cause controller to assign without a team assignment
        if (assignToMeTeamVal === unassignedTeamValue) {
            assignToMeTeamVal = null;
        }

        //if we have multiple teams included in the work items being assigned to me, set to -1, which will cause controller
        //to look up and keep existing team assignments
        if (assignToMeTeamVal === assignToCurrentTeamValue) {
            assignToMeTeamVal = -1;
        }

        assignWorkItemsToMe(workItemIds, assignToMeTeamVal);
    },

    brokerWorkItemsMain: function () {
    	var brokerSubmitButton = $("#brokerSubmitButton");
        brokerSubmitButton.attr("disabled", "disabled");
        var brokerNote = $("#brokerNote");
        var brokerNoteVal = brokerNote.val();
		//leave some room for the system generated broker text
        var noteValidationError = workQueueModals.isEmptyNote(brokerNoteVal, "brokerNote", 1500);

        if (noteValidationError != null) {
            brokerSubmitButton.removeAttr("disabled");
            $("#brokerErrorPlaceholder").html(noteValidationError);
            $("#brokerErrorDiv").show();
            workQueueModals.removeOverlay();
        } else {
        	var regionalOfficesSelect = $("#regionalOfficesSelect");
        	if (regionalOfficesSelect.length) {
        		handleRegionalOfficeBrokering(regionalOfficesSelect, brokerSubmitButton, brokerNoteVal);
			} else {
        		handleDivisionBrokering(brokerSubmitButton, brokerNoteVal);
			}
        }
    },

    nwqTransferClaimsMain: function () {
        var nwqTransferClaimsSubmitButton = $("#nwqTransferClaimsSubmitButton");
        nwqTransferClaimsSubmitButton.attr("disabled", "disabled");

        var transferNote = $("#nwqTransferClaimsPermanentNoteText");
        var transferNoteVal = transferNote.val();

        var errorPlaceHolder = $("#nwqTransferClaimsErrorPlaceholder");
        var errorPlaceHolderDiv = $("#nwqTransferClaimsErrorDiv");

        var noteValidationError = workQueueModals.isEmptyNote(transferNoteVal, "transferNote", 1500);

        if (noteValidationError != null) {
            nwqTransferClaimsSubmitButton.removeAttr("disabled");

            errorPlaceHolder.html(noteValidationError);
            errorPlaceHolderDiv.show();
            workQueueModals.removeOverlay();
        } else {
            var locationLabel = $("#nwqTransferClaimsROTypeahead").val();
            var locationValue = $("#nwqTransferClaimsROTypeaheadValue").val();

            if (locationLabel == null || locationLabel == "") {
                nwqTransferClaimsSubmitButton.removeAttr("disabled");

                errorPlaceHolder.html(emptyNwqTransferLocation);
                errorPlaceHolderDiv.show();
                workQueueModals.removeOverlay();
            } else {
                var validLocation = checkForValidLocation(nwqTransferLocationLabels, locationLabel);

                if (validLocation) {
                    var locationType;
                    var locationId;
                    var stationNumber;

                    switch (locationLabel) {
                        case 'Pension Management Center':
                            locationType = 'PMC';
                            locationId = 0;
                            stationNumber = "";
                            break;
                        case 'Veteran Local Regional Office':
                            locationType = 'VETERAN_LOCAL_RO';
                            locationId = 0;
                            stationNumber = "";
                            break;
                        case 'Claim Establishment Regional Office':
                            locationType = 'CLAIM_ESTABLISHMENT_RO';
                            locationId = 0;
                            stationNumber = "";
                            break;
                        default:
                            locationType = 'REGIONAL_OFFICE';
                            locationId = locationValue;
                            stationNumber = locationLabel.slice(0, locationLabel.indexOf("-") - 1);
                            break;
                    }

                    var workItemIds = workQueueModals.getWorkItemIds();

                    nwqTransferClaims(workItemIds, stationNumber, locationId, locationType, transferNoteVal);
                } else {
                    nwqTransferClaimsSubmitButton.removeAttr("disabled");

                    errorPlaceHolder.html(invalidNwqTransferLocation);
                    errorPlaceHolderDiv.show();
                    workQueueModals.removeOverlay();
                }
            }
        }
    },

    updateTeamAssignmentForWorkItemsMain: function () {

        var teamAssignmentSubmitButton = $("#changeTeamAssignmentSubmitButton");
        teamAssignmentSubmitButton.attr("disabled", "disabled");

        var teamAssignmentTeam = $("#changeTeamAssignmentTeamsSelect").val();

        if (teamAssignmentTeam == unassignedTeamValue) {
            teamAssignmentSubmitButton.removeAttr("disabled");

            $("#changeTeamAssignmentErrorPlaceholder").html("Please select a team.");
            $("#changeTeamAssignmentErrorDiv").show();
            workQueueModals.removeOverlay();
        } else {

            var workItemIds = workQueueModals.getWorkItemIds();

            updateTeamAssignmentForWorkItems(workItemIds, teamAssignmentTeam);
        }
    },

    checkForDeferralsMain: function (workItemId, fileNumber) {
        checkForDeferrals(workItemId, fileNumber);
    },

    populateClaimStatusesForCompletionMain: function (uploadPending, workItemId) {

        var completionClaimStatuses = $("#completionClaimStatusesSelect");
        var completionClaimStatusesLoadingMsg = $("#completionClaimStatusesLoadingMsg");
        workQueueModals.showLoadingCounter(completionClaimStatuses, completionClaimStatusesLoadingMsg, "Claim States", "completionClaimStatuses");

        populateClaimStatusesForCompletion(uploadPending, workItemId);
    },


    populateAssociatedClaimsForCompletionMain: function (workItemId, fileNumber, claimId) {

        var completionAssociatedClaims = $("#completeWorkItems");
        var completionAssociatedClaimsLoadingMsg = $("#completeWorkItemsLoadingMsg");
        workQueueModals.showLoadingCounter(completionAssociatedClaims, completionAssociatedClaimsLoadingMsg, "Associated Claims", "completeWorkItems");

        workQueueModals.initializeAssociatedWorkItemsTable(workItemId, fileNumber, claimId);
    },

    populateClaimCloseReasonsMain: function (claimStatus) {

        var closeWorkItemReasons = $("#closeWorkItemReasonsSelect");
        var closeWorkItemReasonsLoadingMsg = $("#closeWorkItemReasonsLoadingMsg");

        workQueueModals.showLoadingCounter(closeWorkItemReasons, closeWorkItemReasonsLoadingMsg, "Reasons", "closeWorkItemReasons");

        populateClaimCloseReasons(claimStatus);
    },

    populateWorkItemPriorityForReassignMain: function () {
        workQueueModals.showLoadingCounter($("#reassignPrioritySelect"), $("#reassignPriorityLoadingMsg"), "Priorities", "reassignPriority");
        populateWorkItemPriorities(
            workQueueModals.displayWorkItemPriorityForReassign,
            $("#reassignWorkItemModal"),
            $("#reassignErrorPlaceholder"),
            $("#reassignErrorDiv"));
    },
    populateWorkItemPriorityForUnassignMain: function () {
        workQueueModals.showLoadingCounter($("#unassignPrioritySelect"), $("#unassignPriorityLoadingMsg"), "Priorities", "unassignPriority");
        populateWorkItemPriorities(
            workQueueModals.displayWorkItemPriorityForUnassign,
            $("#unassignWorkItemModal"),
            $("#unassignErrorPlaceholder"),
            $("#unassignErrorDiv"));
    },
    populateWorkItemPriorityForUpdatePriorityMain: function () {
        workQueueModals.showLoadingCounter($("#prioritySelect"), $("#priorityLoadingMsg"), "Priorities", "priority");
        populateWorkItemPriorities(
            workQueueModals.displayWorkItemPriorityForUpdatePriority,
            $("#updateWorkItemPriorityModal"),
            $("#updatePriorityErrorPlaceholder"),
            $("#updatePriorityErrorDiv"));
    },

	populateRegionalOfficesForBrokeringMain: function () {
    	var regionalOffices = $("#regionalOfficesSelect");
		var regionalOfficesLoadingMsg = $("#regionalOfficesLoadingMsg");

		workQueueModals.showLoadingCounter(regionalOffices, regionalOfficesLoadingMsg, "Regional Offices", "regionalOffices");

		populateRegionalOfficesForBrokering();
	},

    populateClaimAuthoritiesForBrokeringMain: function () {
    	var claimAuthorities = $("#claimAuthoritiesTypeAhead");
        var claimAuthoritiesLoadingMsg = $("#claimAuthoritiesLoadingMessage");

        workQueueModals.showLoadingCounter(claimAuthorities, claimAuthoritiesLoadingMsg, "Claim Authorities", "claimAuthoritiesTypeahead");

		populateLocationsForClaimAuthoritiesModal();
    },

	populateCompleteWorkItemModalTypeaheadMain: function () {
		var validClaimLocations = $("#completeWorkItemClaimLocationTypeahead");
		var validClaimLocationsLoadingMsg = $("#completeWorkItemClaimLocationTypeaheadLoadingMessage");

		workQueueModals.showLoadingCounter(validClaimLocations, validClaimLocationsLoadingMsg, "Valid Claim Locations", "ompleteWorkItemClaimLocationTypeahead");

		populateLocationsForValidClaimLocationsModal();
	},

    populateTransferLocationsForNwqTransferClaimsModal: function () {
        var locationsTypeahead = $("#nwqTransferClaimsROTypeahead");
        var locationsLoadingMessage = $("#nwqTransferClaimsLoadingMessage");

        workQueueModals.showLoadingCounter(locationsTypeahead, locationsLoadingMessage, "Locations", "locationsTypeahead");

        populateLocationsForNwqTransferClaimsModal();
    },
	populateReassignLocationsForReassignClaimsModal: function () {
		var locationsTypeahead = $("#reassignClaimAuthorityTypeahead");
		var locationsLoadingMessage = $("#reassignClaimsLoadingMessage");
		$("#reassignClaimAuthorityTypeaheadViewButton").hide();

		workQueueModals.showLoadingCounter(locationsTypeahead, locationsLoadingMessage, "Locations", "locationsTypeahead");

		populateLocationsForReassignClaimsModal();
	},

    populateUsersForCompletionMain: function (workItemId, claimStatus) {

        var completeUsers = $("#completeUsersSelect");
        var completeUsersLoadingMsg = $("#completeUsersLoadingMsg");

        workQueueModals.showLoadingCounter(completeUsers, completeUsersLoadingMsg, "Users", "completeUsers");

        populateUsersForCompletion(workItemId, claimStatus);
    },
    populateUsersForReassignMain: function (selectedUserVal) {
        var reassignUsers = $("#reassignUsersSelect");
        var teamReassign = $("#reassignTeamsSelect");

        var reassignUserSelectedVal = reassignUsers.val();
        var teamReassignSelectedVal = teamReassign.val();


        //during the initial load nothing should be selected from either select box
        //or
        //repopulate the user list if the user changes both the team back to unassigned
        //reassignUserSelectedVal is going to be null because we reset this box before repopulation
        if ((teamReassignSelectedVal == null && reassignUserSelectedVal == null)
            || (teamReassignSelectedVal == 'NONE' && reassignUserSelectedVal == null)) {

            var reassignUsersLoadingMsg = $("#reassignUsersLoadingMsg");

            workQueueModals.showLoadingCounter(reassignUsers, reassignUsersLoadingMsg, "Users", "reassignUsers");

            var workItemIds = workQueueModals.getWorkItemIds();

            populateUsersForReassign(null, workItemIds, null);


        }
        //If the user selects a team first we need to repopulate the users based on the team selected
        //Care must be taken to make sure the users hasnt selected a user first then a team, so we check to make sure a user has not been selected
        else if (teamReassignSelectedVal != null && teamReassignSelectedVal != "NONE" && reassignUserSelectedVal == null) {
            var workItemIds = workQueueModals.getWorkItemIds();
            populateUsersForReassign(teamReassignSelectedVal, workItemIds, selectedUserVal);

        }
        // Added for defect 648447 to allow the user to unselect a team, keep the currently selected user for reassignement
        //while reloading the list of users and the list of teams. Otherwise the list of teams would reload the user list would
        //still only contain users for the previously selected team.
        else if ((teamReassignSelectedVal == null || teamReassignSelectedVal == "NONE") && reassignUserSelectedVal != null) {
            var workItemIds = workQueueModals.getWorkItemIds();
            var preserveSelectedUser = selectedUserVal;
            populateUsersForReassign(null, workItemIds, selectedUserVal);

        }
    },

    populateTeamsForAssignToMeMain: function () {

        var assignToMeTeams = $("#assignToMeTeamsSelect");
        var assignToMeTeamsLoadingMsg = $("#assignToMeTeamsLoadingMsg");

        workQueueModals.showLoadingCounter(assignToMeTeams, assignToMeTeamsLoadingMsg, "Teams", "assignToMeTeams");

        var currentUserId = workQueueModals.getCurrentUserId();

        populateTeamsForUser(currentUserId,
            workQueueModals.displayTeamsForAssignToMe,
            workQueueModals.displayUnassignTeamForAssignToMe,
            $("#assignWorkItemToMeModal"),
            $("#assignToMeErrorPlaceholder"),
            $("#assignToMeErrorDiv"));
    },
    populateTeamsForCompleteMain: function () {

        var completeTeams = $("#completeTeamsSelect");
        var completeTeamsLoadingMsg = $("#completeTeamsLoadingMsg");

        workQueueModals.showLoadingCounter(completeTeams, completeTeamsLoadingMsg, "Teams", "completeTeams");

        var completeUserVal = $("#completeUsersSelect").val();
        //more of an initial load, only for loading teams when we are not filtering teams based on a user
        if ((completeUserVal === unassignedUserValue) || (completeUserVal === null)) {
            completeTeams[0].options.length = 0;
            workQueueModals.disableElement(completeTeams);
        } else {
            populateTeamsForUser(completeUserVal,
                workQueueModals.displayTeamsForComplete,
                null,
                $("#completeWorkItemModal"),
                $("#completeErrorPlaceholder"),
                $("#completeErrorDiv"));
        }
    },
    populateTeamsForReassignMain: function (selectedTeamValue) {

        var reassignTeams = $("#reassignTeamsSelect");
        var reassignTeamsLoadingMsg = $("#reassignTeamsLoadingMsg");

        workQueueModals.showLoadingCounter(reassignTeams, reassignTeamsLoadingMsg, "Teams", "reassignTeams");

        var reassignUserVal = $("#reassignUsersSelect").val();
        //more of an initial load, only for loading teams when we are not filtering teams based on a user
        if ((reassignUserVal === unassignedUserValue) || (reassignUserVal === null)) {
            populateAllTeamsForCurrentRO(
                workQueueModals.displayTeamsForReassign,
                workQueueModals.displayUnassignTeamForReassign,
                $("#reassignWorkItemModal"),
                $("#reassignErrorPlaceholder"),
                $("#reassignErrorDiv"));
        } else {
            populateTeamsForUserReassign(reassignUserVal,
                workQueueModals.displayTeamsForReassign,
                $("#reassignErrorPlaceholder"),
                $("#reassignErrorDiv"),
                selectedTeamValue);
        }
    },
    populateTeamsForTeamAssignmentMain: function () {

        var teamAssignmentTeams = $("#changeTeamAssignmentTeamsSelect");
        var teamAssignmentTeamsLoadingMsg = $("#changeTeamAssignmentTeamsLoadingMsg");

        workQueueModals.showLoadingCounter(teamAssignmentTeams, teamAssignmentTeamsLoadingMsg, "Teams", "changeTeamAssignmentTeams");

        var teamMember = workQueueModals.getTeamMemberUserId();

        populateTeamsForUser(teamMember,
            workQueueModals.displayTeamsForTeamAssignment,
            workQueueModals.displayUnassignTeamForTeamAssignment,
            $("#changeTeamAssignmentModal"),
            $("#changeTeamAssignmentErrorPlaceholder"),
            $("#changeTeamAssignmentErrorDiv"));
    },

    populateReassignWorkItemsTableMain: function () {
        workQueueModals.displayWorkItemList($("#reassignWorkItems"), $("#reassignWorkItemsTable"), workQueueModals.getReassignWorkItemsTableRemoveLink);
        findAndRemoveUnauthorizedWorkItemsForReassign();
        workQueueModals.findAndFlagPendingDeferralWorkItemsForReassign();
    },
    populateUnassignWorkItemsTableMain: function () {
        workQueueModals.displayWorkItemList($("#unassignWorkItems"), $("#unassignWorkItemsTable"), workQueueModals.getUnassignWorkItemsTableRemoveLink);
        findAndRemoveUnauthorizedWorkItemsForUnassign();
        workQueueModals.findAndFlagPendingDeferralWorkItemsForUnassign();
    },
    populateUpdatePriorityWorkItemsTableMain: function () {
        workQueueModals.displayWorkItemList($("#updatePriorityWorkItems"), $("#updatePriorityWorkItemsTable"), workQueueModals.getUpdatePriorityWorkItemsTableRemoveLink);
        findAndRemoveUnauthorizedWorkItemsForUpdatePriority();
    },
    populateAssignToMeWorkItemsTableMain: function () {
        workQueueModals.displayWorkItemList($("#assignToMeWorkItems"), $("#assignToMeWorkItemsTable"), workQueueModals.getAssignToMeWorkItemsTableRemoveLink);
        findAndRemoveUnauthorizedWorkItemsForAssignToMe();
    },
    populateBrokerWorkItemsTableMain: function () {
        workQueueModals.displayWorkItemList($("#brokerWorkItems"), $("#brokerWorkItemsTable"), workQueueModals.getBrokeredWorkItemsTableRemoveLink);
    },
    populateNwqTransferClaimsModal: function () {
        workQueueModals.displayWorkItemList($("#nwqTransferClaims"), $("#nwqTransferClaimsTable"), workQueueModals.getNwqTransferClaimsTableRemoveLink);
    },
    populateChangeTeamAssignmentWorkItemsTableMain: function () {
        workQueueModals.displayWorkItemList($("#changeTeamAssignmentWorkItems"), $("#changeTeamAssignmentWorkItemsTable"), workQueueModals.getChangeTeamAssignmentWorkItemsTableRemoveLink);
        findAndRemoveUnauthorizedWorkItemsForChangeTeamAssignment();
    },

    displayClaimCloseReasons: function (ajaxResponse) {

        if ($("#closeWorkItemReasonsSelect option").length > 0) {
            $("#closeWorkItemReasonsSelect").find('option').remove().end();
        }

        var closeWorkItemReasons = $("#closeWorkItemReasonsSelect");

        workQueueModals.displayUnselectedOption(closeWorkItemReasons);

        var reasonList = ajaxResponse['data'];

        if (reasonList === null) {
            closeWorkItemReasons.attr('disabled', true);
        } else {
            var reasonListLength = reasonList.length;

            if (reasonListLength > 0) {
                for (var idx = 0; idx < reasonListLength; idx++) {

                    var currentReason = reasonList[idx];

                    var reasonCode = currentReason['code'];
                    var reasonName = currentReason['name'];

                    var reasonOption = '<option value="' + reasonCode + '">' + reasonName + '</option>';

                    closeWorkItemReasons.append(reasonOption);
                }
            } else {
                closeWorkItemReasons.attr('disabled', true);
            }
        }

        workQueueModals.hideLoadingCounter(closeWorkItemReasons, $("#closeWorkItemReasonsLoadingMsg"));
    },

    displayClaimStatusesForCompletion: function (ajaxResponse) {
        workQueueModals.displayEnumOptions(ajaxResponse, $("#completionClaimStatusesSelect"), $("#completionClaimStatusesLoadingMsg"));
    },

    displayWorkItemPriorityForReassign: function (ajaxResponse) {
        workQueueModals.displayEnumOptions(ajaxResponse, $("#reassignPrioritySelect"), $("#reassignPriorityLoadingMsg"));
    },
    displayWorkItemPriorityForUnassign: function (ajaxResponse) {
        workQueueModals.displayEnumOptions(ajaxResponse, $("#unassignPrioritySelect"), $("#unassignPriorityLoadingMsg"));
    },
    displayWorkItemPriorityForUpdatePriority: function (ajaxResponse) {
        workQueueModals.displayEnumOptions(ajaxResponse, $("#prioritySelect"), $("#priorityLoadingMsg"));
    },

    displayRegionalOfficesForBrokering: function (ajaxResponse) {

        var regionalOffices = $("#regionalOfficesSelect");

        workQueueModals.displayUnselectedOption(regionalOffices);

        var regionalOfficeList = ajaxResponse['data'];

        if (regionalOfficeList === null) {
            regionalOffices.attr('disabled', true);
        } else {
            var regionalOfficeListLength = regionalOfficeList.length;

            if (regionalOfficeListLength > 0) {
                for (var idx = 0; idx < regionalOfficeListLength; idx++) {

                    var currentRO = regionalOfficeList[idx];

                    var roName = currentRO['roName'];
                    var stationNumber = currentRO['stationNumber'];

                    var reasonOption = '<option value="' + stationNumber + '">' + roName + '</option>';

                    regionalOffices.append(reasonOption);
                }
            } else {
                regionalOffices.attr('disabled', true);
            }
        }

        workQueueModals.hideLoadingCounter(regionalOffices, $("#regionalOfficesLoadingMsg"));
    },

    displayLocationsForNwqTransferClaimsModal: function (ajaxResponse) {
        var locationList = ajaxResponse['data'];

        var locationsTypeaheadBox = $('#nwqTransferClaimsROTypeahead');

        if ((locationList == null) || (locationList.length == 0)) {
            locationsTypeaheadBox.attr('disabled', true);
        } else {
            var locationLabels = '';
            var locationLabelValues = [];

            for (var i = 0; i < locationList.length; i++) {
                var currentLocation = locationList[i];
                var locationType = currentLocation['locationType'];
                var stationNumber = currentLocation['stationNumber'];
                var specialMissionId = currentLocation['specialMissionId'];
                var locationName = currentLocation['name'];
                var locationId = '0';

                var locationLabel;

                switch (locationType) {
                    case 'PMC':
                        locationLabel = locationName;
                        break;
                    case 'VETERAN_LOCAL_RO':
                        locationLabel = locationName;
                        break;
                    case 'CLAIM_ESTABLISHMENT_RO':
                        locationLabel = locationName;
                        break;
                    case 'REGIONAL_OFFICE':
                        locationLabel = stationNumber + " - " + locationName;
                        if (specialMissionId) {
                            locationId = specialMissionId;
                        } else {
                            locationId = stationNumber;
                        }
                        break;
                    default:
                        $("#nwqTransferClaimsSubmitButton").attr('disabled', 'disabled');
                        $("#nwqTransferClaimsErrorPlaceholder").html('Unknown transfer location type encountered');
                        $("#nwqTransferClaimsErrorDiv").show();
                        break;
                }
                locationLabelValues.push({
                    label: locationLabel,
                    value: locationId
                });

                locationLabels += locationLabel + '|';

            }

            //Clear last pipe
            locationLabels = locationLabels.substr(0, locationLabels.length - 1);

            var locationLabelsList = locationLabels.split('|');
            nwqTransferLocationLabels = locationLabelsList;

            setupNwqTransferClaimsTypeahead(locationLabelValues);
        }

        workQueueModals.hideLoadingCounter(locationsTypeaheadBox, $("#nwqTransferClaimsLoadingMessage"));
    },
	displayLocationsForReassignClaimsModal: function (ajaxResponse) {
		var locationList = ajaxResponse['data'];

		var locationsTypeaheadBox = $('#reassignClaimAuthorityTypeahead');

		if ((locationList == null) || (locationList.length === 0)) {
			locationsTypeaheadBox.attr('disabled', true);
		} else if (locationList.length === 1 && locationList[0].specialMissionId !== null) {
			//todo we're at a division disable this field set the special mission value for reassign
			$("#reassignClaimAuthorityTypeaheadValue").val(locationList[0].specialMissionId);
			$("#form-item-reassignClaimAuthorityTypeahead").hide();
		}else {
			var locationLabels = '';
			var locationLabelValues = [];

			$("#reassignClaimAuthorityTypeaheadViewButton").show();

			for (var i = 0; i < locationList.length; i++) {
				var currentLocation = locationList[i];
				var stationNumberString = currentLocation['stationNumber'];
				var stationNumber = (stationNumberString === null || isNaN(parseInt(stationNumberString, 10)) ? null : parseInt(stationNumberString, 10));
				var specialMissionId = currentLocation['specialMissionId'];
				var locationName = currentLocation['name'];
				var locationId = '0';

				var locationLabel;


				locationLabel = stationNumber + " - " + locationName;
				if (specialMissionId) {
					locationId = specialMissionId;
				} else {
					locationId = stationNumber;
				}

				$("#reassignClaimsSubmitButton").attr('disabled', 'disabled');
				$("#reassignClaimsErrorPlaceholder").html('Unknown transfer location type encountered');
				$("#reassignClaimsErrorDiv").show();

				locationLabelValues.push({
					label: locationLabel,
					value: locationId
				});

				locationLabels += locationLabel + '|';

			}

			//Clear last pipe
			locationLabels = locationLabels.substr(0, locationLabels.length - 1);

			reassignLocationLabels = locationLabels.split('|');

			setupReassignClaimsTypeahead(locationLabelValues);
		}

		workQueueModals.hideLoadingCounter(locationsTypeaheadBox, $("#reassignClaimsLoadingMessage"));
	},

	displayLocationsForClaimAuthoritiesModal: function (ajaxResponse) {
		var locationList = ajaxResponse['data'];

		var locationsTypeaheadBox = $('#claimAuthoritiesTypeahead');

		if ((locationList == null) || (locationList.length === 0)) {
			locationsTypeaheadBox.attr('disabled', true);
		} else {
			var locationLabels = '';
			var locationLabelValues = [];

			for (var i = 0; i < locationList.length; i++) {
				var currentLocation = locationList[i];
				var stationNumber = currentLocation['stationNumber'];
				var divisionId = currentLocation['divisionId'];
				var locationName = currentLocation['name'];
				var locationId = '0';

				var locationLabel;
				if (divisionId) {
					locationLabel = locationName;
					locationId = divisionId;
				} else {
					locationLabel = stationNumber + " - " + locationName;
					locationId = stationNumber;
				}

				locationLabelValues.push({
					label: locationLabel,
					value: locationId,
				});

				locationLabels += locationLabel + '|';
			}

			//Clear last pipe
			locationLabels = locationLabels.substr(0, locationLabels.length - 1);

			claimAuthoritiesLabels = locationLabels.split('|');

			setupClaimAuthoritiesTypeahead(locationLabelValues);
		}

		workQueueModals.hideLoadingCounter(locationsTypeaheadBox, $("#claimAuthoritiesLoadingMessage"));
	},

	displayValidLocationsForCompleteWorkItemModal: function (ajaxResponse) {
		var locationList = ajaxResponse['data'];

		var locationsTypeaheadBox = $('#completeWorkItemClaimLocationTypeahead');

		if (locationList == null || locationList.length === 0) {
			workQueueModals.hideLoadingCounter(locationsTypeaheadBox,
				$("#completeWorkItemClaimLocationTypeaheadLoadingMessage"));

			workQueueModals.disableElement(locationsTypeaheadBox);
		} else {
			locationsTypeaheadBox.attr('disabled', false);
			locationsTypeaheadBox.attr('hidden', false);

			var locationLabels = '';
			var locationLabelValues = [];

			for (var i = 0; i < locationList.length; i++) {
				var currentLocation = locationList[i];
				var stationNumber = currentLocation['stationNumber'];
				var specialMissionId = currentLocation['specialMissionId'];
				var locationName = currentLocation['name'];
				var locationId = '0';

				var locationLabel = locationName;
				if (specialMissionId) {
					locationId = specialMissionId;
				} else {
					locationId = null;
				}

				locationLabelValues.push({
					label: locationLabel,
					value: locationId,
				});

				locationLabels += locationLabel + '|';
			}

			//Clear last pipe
			locationLabels = locationLabels.substr(0, locationLabels.length - 1);

			validClaimLocationLabels = locationLabels.split('|');

			setupCompleteWorkItemClaimLocationTypeahead(locationLabelValues);

			workQueueModals.hideLoadingCounter(locationsTypeaheadBox,
				$("#completeWorkItemClaimLocationTypeaheadLoadingMessage"));
		}
	},

    displayUsersForCompletion: function (ajaxResponse) {
        // We should leave unassigned as an option when completing a work item, please leave this as true!
        workQueueModals.displayUsers(ajaxResponse, $("#completeUsersSelect"), true, $("#completeUsersLoadingMsg"));
    },
    displayUnassignUserForCompletion: function () {
        var completeUsers = $("#completeUsersSelect");
        workQueueModals.displayUnassignedOption(completeUsers);

        workQueueModals.hideLoadingCounter(completeUsers, $("#completeUsersLoadingMsg"));
    },

    displayUsersForReassign: function (ajaxResponse, selectedUser) {
        var canUnassignWorkItem = $("#canUnassignWorkItem").val() === "true";

        workQueueModals.displayReassignUsers(ajaxResponse, $("#reassignUsersSelect"), canUnassignWorkItem, $("#reassignUsersLoadingMsg"), selectedUser);
    },
    displayUnassignUserForReassign: function () {
        var reassignUsers = $("#reassignUsersSelect");
        workQueueModals.displayUnassignedOption(reassignUsers);

        workQueueModals.hideLoadingCounter(reassignUsers, $("#reassignUsersLoadingMsg"));
    },

    displayTeamsForAssignToMe: function (ajaxResponse) {
        var teamList = ajaxResponse['data'];
        var teamsElement = $("#assignToMeTeamsSelect");
        var loadingMsg = $("#assignToMeTeamsLoadingMsg");

        if (teamList === null || teamList.length == 0) {
            teamsElement.attr('disabled', true);
        }
        else {
            var teamListLength = teamList.length;

            if (teamListLength > 0) {

                // streamline the code for this part -- showing "unassigned" only once and on the top
                workQueueModals.displayUnassignedOption(teamsElement);

                //value of the team dropdown option to set
                var valueToSet;

                //Should only be getting checkedItemsList if the user is on the work queue page, not work item details
                if (!isDetails) {

                    // per defect 229709, need to set the team drop down appropriately
                    // if the selected work items are all on the same team, we just identify that team (in the team variable)
                    // if the selected work items are on more than one team, set the moreThanOneTeamFlag to indicate this
                    var checkedItems = workQueue.getCheckedWorkItemList();
                    var team;
                    var otherTeam;
                    var moreThanOneTeamFlag = false;

                    var checkedTeams = new Array();
                    var teamIndex = 0;

                    for (var key in checkedItems) {
                        if (checkedItems.hasOwnProperty(key)) {
                            var item = checkedItems[key];
                            checkedTeams[teamIndex++] = item['team'];
                        }
                    }


                    var userTeams = new Array();
                    var userIndex = 0;

                    for (var idx = 0; idx < teamListLength; idx++) {

                        userTeams[userIndex++] = teamList[idx].name;
                    }

                    //go through the checked work items to determine the team, and also if there is more than one team involved

                    var memberOfAllTeams = true;

                    for (var idx = 0; idx < checkedTeams.length; idx++) {

                        var tempTeam = checkedTeams[idx];

                        if (userTeams.indexOf(tempTeam) == -1) {
                            memberOfAllTeams = false;
                            break;
                        }
                    }

                    // user is a member of all selected teams, so give them the option to keep team assignment

                    if (memberOfAllTeams) {
                        moreThanOneTeamFlag = true;
                        workQueueModals.displayAssignToCurrentTeamOption(teamsElement);
                        valueToSet = assignToCurrentTeamValue;
                    }
                }

                //go through the list of available teams for this user, to set the dropdown options
                for (var idx = 0; idx < teamListLength; idx++) {

                    var currentTeam = teamList[idx];

                    var groupId = currentTeam['id'];
                    var name = currentTeam['name'];

                    var userOption = $('<option/>');
                    userOption.attr('value', groupId);
                    userOption.appendText(name);

                    if (teamListLength == 1) {
                        teamsElement.append(userOption);
                        if (valueToSet != assignToCurrentTeamValue) {
                            valueToSet = groupId;
                        }
						/*
						 if($("input.workItemCheck:checked").length > 1){
						 var blankOption = '<option value="' + "blankValue" + '"></option>';
						 teamsElement.prepend(blankOption);
						 }
						 */
                    }
                    else {
                        if ($("input.workItemCheck:checked").length == 0) {

                            teamsElement.append(userOption);
                        }
                        else {
                            $("input.workItemCheck:checked").each(function () {
                                var index = dataTableUtil.getColumnIndexByName($("#roWorkQueue").dataTable(), "name");

                                if (index > -1) {
                                    var $dataTableCell = $($("#roWorkQueue").dataTable().fnGetData($(this).closest('tr')[0], index));
                                    if (name == $dataTableCell.text()) {
                                        teamsElement.prepend(userOption);
                                    }
                                    else {
                                        teamsElement.append(userOption);
                                    }
                                }

                                else {
                                    teamsElement.append(userOption);
                                }

                            });
                        }

                        //need to reenable the drop down in case it was previously disabled
                        teamsElement.attr('disabled', false);
                    }
                }
            }
        }

        //set the appropriate default team value
        if (valueToSet != null) {
            teamsElement.val(valueToSet);
        }

        workQueueModals.hideLoadingCounter(teamsElement, loadingMsg);

    },
    displayUnassignTeamForAssignToMe: function () {
        var assignToMeTeams = $("#assignToMeTeamsSelect");
        workQueueModals.displayUnassignedOption(assignToMeTeams);

        workQueueModals.hideLoadingCounter(assignToMeTeams, $("#assignToMeTeamsLoadingMsg"));
    },
    displayTeamsForComplete: function (ajaxResponse) {
        workQueueModals.displayCompleteTeams(ajaxResponse, $("#completeTeamsSelect"), false, $("#completeTeamsLoadingMsg"));
    },
    displayTeamsForReassign: function (ajaxResponse) {
        workQueueModals.displayTeams(ajaxResponse, $("#reassignTeamsSelect"), true, $("#reassignTeamsLoadingMsg"));
    },
    displayTeamsForReassignBasedOnUser: function (ajaxResponse, selectedTeamVal) {
        workQueueModals.displayReassignTeams(ajaxResponse, $("#reassignTeamsSelect"), true, $("#reassignTeamsLoadingMsg"), selectedTeamVal);
    },
    displayUnassignTeamForReassign: function () {
        var reassignTeams = $("#reassignTeamsSelect");
        workQueueModals.displayUnassignedOption(reassignTeams);

        workQueueModals.hideLoadingCounter(reassignTeams, $("#reassignTeamsLoadingMsg"));
    },

    displayTeamsForTeamAssignment: function (ajaxResponse) {
        workQueueModals.displayTeams(ajaxResponse, $("#changeTeamAssignmentTeamsSelect"), true, $("#changeTeamAssignmentTeamsLoadingMsg"));
    },
    displayUnassignTeamForTeamAssignment: function () {
        var teamAssignmentTeams = $("#changeTeamAssignmentTeamsSelect");
        workQueueModals.displayUnassignedOption(teamAssignmentTeams);

        workQueueModals.hideLoadingCounter(teamAssignmentTeams, $("#changeTeamAssignmentTeamsLoadingMsg"));
    },
    displayTeams: function (ajaxResponse, teamsElement, displayUnassigned, loadingMsg) {

        var teamList = ajaxResponse['data'];

        if (teamList === null || teamList.length == 0) {
            teamsElement.attr('disabled', true);
        }
        else {
            var teamListLength = teamList.length;

            if (teamListLength > 0) {

                // streamline the code for this part -- showing "unassigned" only once and on the top
                if (displayUnassigned) {
                    workQueueModals.displayUnassignedOption(teamsElement);
                }

                for (var idx = 0; idx < teamListLength; idx++) {

                    var currentTeam = teamList[idx];

                    var groupId = currentTeam['id'];
                    var name = currentTeam['name'];

                    var userOption = $('<option/>');
                    userOption.attr('value', groupId);
                    userOption.appendText(name);

                    if (teamListLength == 1) {
                        teamsElement.append(userOption);
						/* Not sure why this is here...breaks assign options when user is a member of exactly one team
						 and attempts to act on more than 1 item
						 if($("input.workItemCheck:checked").length > 1){
						 var blankOption = '<option value="' + "blankValue" + '"></option>';
						 //teamsElement.prepend(blankOption);
						 }
						 */
                    }
                    else {
                        if ($("input.workItemCheck:checked").length == 0) {

                            teamsElement.append(userOption);
                        }
                        else {
                            $("input.workItemCheck:checked").each(function () {
                                var index = dataTableUtil.getColumnIndexByName($("#roWorkQueue").dataTable(), "name");

                                if (index > -1) {
                                    var $dataTableCell = $($("#roWorkQueue").dataTable().fnGetData($(this).closest('tr')[0], index));
                                    if (name == $dataTableCell.text()) {
                                        teamsElement.prepend(userOption);
                                    }
                                    else {
                                        teamsElement.append(userOption);
                                    }
                                }

                                else {
                                    teamsElement.append(userOption);
                                }

                            });
                        }

//                      if($("input.workItemCheck:checked").length > 1){
//                          var blankOption = '<option value="' + "blankValue" + '"></option>';
//                          teamsElement.prepend(blankOption);
//                      }

                        //need to reenable the drop down in case it was previously disabled
                        teamsElement.attr('disabled', false);
                    }
                }
            }
        }

        workQueueModals.hideLoadingCounter(teamsElement, loadingMsg);
    },
    displayCompleteTeams: function (ajaxResponse, teamsElement, displayUnassigned, loadingMsg) {

        var teamList = ajaxResponse['data'];

        if (teamList === null || teamList.length == 0) {
            teamsElement.attr('disabled', true);
            var userOption = $('<option/>');
            userOption.attr('value', 'NONE');
            userOption.appendText("No Teams Available For User");
            teamsElement.append(userOption);
        }
        else {
            var teamListLength = teamList.length;

            if (teamListLength > 0) {

                // streamline the code for this part -- showing "unassigned" only once and on the top
                if (displayUnassigned) {
                    workQueueModals.displayUnassignedOption(teamsElement);
                }

                for (var idx = 0; idx < teamListLength; idx++) {

                    var currentTeam = teamList[idx];

                    var groupId = currentTeam['id'];
                    var name = currentTeam['name'];

                    var userOption = $('<option/>');
                    userOption.attr('value', groupId);
                    userOption.appendText(name);

                    if (teamListLength == 1) {
                        teamsElement.append(userOption);
                        teamsElement.attr('disabled', true);
                    }
                    else {
                        if ($("input.workItemCheck:checked").length == 0) {

                            teamsElement.append(userOption);
                        }
                        else {
                            $("input.workItemCheck:checked").each(function () {
                                var index = dataTableUtil.getColumnIndexByName($("#roWorkQueue").dataTable(), "name");

                                if (index > -1) {
                                    var $dataTableCell = $($("#roWorkQueue").dataTable().fnGetData($(this).closest('tr')[0], index));
                                    if (name == $dataTableCell.text()) {
                                        teamsElement.prepend(userOption);
                                    }
                                    else {
                                        teamsElement.append(userOption);
                                    }
                                }

                                else {
                                    teamsElement.append(userOption);
                                }

                            });
                        }

                        //need to reenable the drop down in case it was previously disabled
                        teamsElement.attr('disabled', false);
                    }
                }
            }
        }

        workQueueModals.hideLoadingCounter(teamsElement, loadingMsg);
    },
    displayReassignTeams: function (ajaxResponse, teamsElement, displayUnassigned, loadingMsg, selectedTeamVal) {

        // Display unassigned only when there is no team associated with the selected user.
        // Otherwise, display all the teams that this selected user is associated with, and do not display unassigned.
        var teamList = ajaxResponse['data'];

        if (teamList === null || teamList.length == 0) {
            if (displayUnassigned) {
                workQueueModals.displayUnassignedOption(teamsElement);
            }
            teamsElement.attr('disabled', true);
        } else {
            teamsElement.attr('aria-disabled', true);

            workQueueModals.displayUnassignedOption(teamsElement);
            var teamListLength = teamList.length;

            if (teamListLength > 0) {
                for (var idx = 0; idx < teamListLength; idx++) {

                    var currentTeam = teamList[idx];

                    var groupId = currentTeam['id'];
                    var name = currentTeam['name'];

                    var userOption = $('<option/>');
                    userOption.attr('value', groupId);
                    userOption.appendText(name);
                    teamsElement.append(userOption)
                }
                //need to reenable the drop down in case it was previously disabled
                teamsElement.attr('disabled', false);
                teamsElement.attr('aria-disabled', false);
            } else {
                teamsElement.attr('disabled', true);
            }
        }

        //reselect the old value if there is one AND the team ID is still in the list
        if (selectedTeamVal != null && selectedTeamVal != 'NONE') {
            //check and see if the value is a current option
            var exists = $("#reassignTeamsSelect option[value='" + selectedTeamVal + "']").length !== 0;
            if (exists == true) {
                //value exists in the current list, reselect the value
                $("#reassignTeamsSelect").val(selectedTeamVal);
            }
        }

        workQueueModals.hideLoadingCounter(teamsElement, loadingMsg);
    },
    displayUsers: function (ajaxResponse, usersElement, displayUnassigned, loadingMsg) {

        if (usersElement[0].options.length > 0) {
            usersElement.find('option').remove().end();
        }

        if (displayUnassigned) {
            workQueueModals.displayUnassignedOption(usersElement);
            $("#unassignedUserWarning").show();
        }

        var userList = ajaxResponse['data'];

        if (userList === null) {
            usersElement.attr('disabled', true);
        } else {
            var userListLength = userList.length;

            if (userListLength > 0) {
                for (var idx = 0; idx < userListLength; idx++) {

                    var currentUser = userList[idx];

                    var vbmsId = currentUser['vbmsId'];
                    var name = currentUser['name'];
                    var userId = currentUser['userId'];
                    var nameAndUserId = name + ' (' + userId + ')';
                    //appending things this way prevents script injections from running
                    var userOption = $('<option/>');
                    userOption.attr('value', vbmsId);
                    userOption.appendText(nameAndUserId);
                    usersElement.append(userOption);
                }
            } else {
                usersElement.attr('disabled', true);
            }
        }


		var user;
		if (typeof workItemDetails !== 'undefined') {
			user = workQueueModals.getCurrentUserId();
		}
		else if (typeof claimDetail !== 'undefined') {
			user = workQueueModals.getClaimUserId();
		}


        workQueueModals.hideLoadingCounter(usersElement, loadingMsg);
		$("#completeUsersSelect option[value= "+ user +"]").attr("selected", "selected");

		workQueueModals.showHideUnassignedUserWarning();
		workQueueModals.toggleTeamsForComplete();
    },
    displayReassignUsers: function (ajaxResponse, usersElement, displayUnassigned, loadingMsg, selectedUser) {

        usersElement[0].options.length = 0;
        if (displayUnassigned) {
            workQueueModals.displayUnassignedOption(usersElement);
        }

        var userList = ajaxResponse['data'];


        if (userList === null) {
            usersElement.attr('disabled', true);
        } else {
            usersElement.attr('aria-disabled', true);
            var userListLength = userList.length;

            if (userListLength > 0) {
                for (var idx = 0; idx < userListLength; idx++) {

                    var currentUser = userList[idx];

                    var vbmsId = currentUser['vbmsId'];
                    var name = currentUser['name'];
                    var userId = currentUser['userId'];
                    var nameAndUserId = name + ' (' + userId + ')';
                    //appending things this way prevents script injections from running
                    var userOption = $('<option/>');
                    userOption.attr('value', vbmsId);
                    userOption.appendText(nameAndUserId);
                    usersElement.append(userOption);

                }
                //reenable the element if it was disabled
                usersElement.attr('aria-disabled', false);
                usersElement.attr('disabled', false);
            } else {
                usersElement.attr('disabled', true);
            }
        }


        //reselect the old value if there is one AND the user ID is still part of the list
        if (selectedUser != null && selectedUser != 'NONE') {
            //check and see if the value is a current option
            var exists = $("#reassignUsersSelect option[value='" + selectedUser + "']").length !== 0;
            if (exists == true) {
                //value exists in the current list, reselect the value
                $("#reassignUsersSelect").val(selectedUser);
            }
        }

        workQueueModals.hideLoadingCounter(usersElement, loadingMsg);
    },
    displayEnumOptions: function (ajaxResponse, enumElement, loadingMsg) {

        workQueueModals.displayUnselectedOption(enumElement);

        var enumList = ajaxResponse['data'];

        if (enumList === null) {
            enumElement.attr('disabled', true);
        } else {
            var enumListLength = enumList.length;

            if (enumListLength > 0) {
                for (var idx = 0; idx < enumListLength; idx++) {

                    var currentEnum = enumList[idx];

                    var enumOption = '<option value="' + currentEnum + '">' + currentEnum + '</option>';

                    enumElement.append(enumOption);
                }
            } else {
                enumElement.attr('disabled', true);
            }
        }

        workQueueModals.hideLoadingCounter(enumElement, loadingMsg);
    },

    displayUnselectedOption: function (element) {
        var unassignedOption = '<option value="' + unselectedOptionValue + '">Select</option>';
        element.append(unassignedOption);
    },
    displayUnassignedOption: function (element) {
        var unassignedOption = '<option value="' + unassignedUserValue + '">Unassigned</option>';
        element.append(unassignedOption);
    },
    displayAssignToCurrentTeamOption: function (element) {
        var assignToCurrentTeamOption = '<option value="' + assignToCurrentTeamValue + '">Assign to Current Team</option>';
        element.append(assignToCurrentTeamOption);
    },
    getCompleteWorkItemsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeCompleteWorkItemsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    getReassignWorkItemsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeReassignWorkItemsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    getUnassignWorkItemsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeUnassignWorkItemsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    getUpdatePriorityWorkItemsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeUpdatePriorityWorkItemsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    getAssignToMeWorkItemsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeAssignToeMeWorkItemsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    getBrokeredWorkItemsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeBrokeredWorkItemsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    getNwqTransferClaimsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeNwqTransferClaimsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    getChangeTeamAssignmentWorkItemsTableRemoveLink: function (workItemId) {
        var iconImgPath = contextPathVal + "/resources_p4/images/12-em-cross.png";
        return '<a href="#" onclick="workQueueModals.removeChangeTeamAssignmentWorkItemsTableRow(' + workItemId + ')"><img src="' + iconImgPath + '" alt="Remove item from work item list"/></a>';
    },
    removeCompleteWorkItemsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#completeWorkItemsTable"), $("#completeWorkItemsError"), $("#completeSubmitButton"));
    },
    removeReassignWorkItemsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#reassignWorkItemsTable"), $("#reassignWorkItemsError"), $("#reassignSubmitButton"));
        workQueueModals.findAndFlagPendingDeferralWorkItemsForReassign();
    },
    removeUnassignWorkItemsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#unassignWorkItemsTable"), $("#unassignWorkItemsError"), $("#unassignSubmitButton"));
        workQueueModals.findAndFlagPendingDeferralWorkItemsForUnassign();
    },
    removeUpdatePriorityWorkItemsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#updatePriorityWorkItemsTable"), $("#updatePriorityWorkItemsError"), $("#updatePrioritySubmitButton"));
    },
    removeAssignToeMeWorkItemsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#assignToMeWorkItemsTable"), $("#assignToMeWorkItemsError"), $("#assignToMeSubmitButton"));
    },
    removeBrokeredWorkItemsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#brokerWorkItemsTable"), $("#brokerWorkItemsError"), $("#brokerSubmitButton"));
    },
    removeNwqTransferClaimsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#nwqTransferClaimsTable"), $("#nwqTransferClaimsListEmptyErrorPlaceholder"), $("#nwqTransferClaimsSubmitButton"));
    },
    removeChangeTeamAssignmentWorkItemsTableRow: function (workItemId) {
        workQueueModals.removeTableRow(workItemId, $("#changeTeamAssignmentWorkItemsTable"), $("#changeTeamAssignmentWorkItemsError"), $("#changeTeamAssignmentSubmitButton"));
    },

    displayWorkItemList: function (itemForm, table, getRemoveLinkFn) {

        if (isDetails) {
            itemForm.hide();
        } else {
            itemForm.show();
            //need to show the table in case something was removed previously,
            //if we don't then the table will never be unhidden.
            table.show();

            var checkedItems = workQueue.getCheckedWorkItemList();
            for (var key in checkedItems) {
                if (checkedItems.hasOwnProperty(key)) {
                    var item = checkedItems[key];

                    var workItemId = item['id'];
                    var claimLabel = item['epCodeClaimLabel'];
                    var veteranName = item['veteranName'];

                    workQueueModals.addTableRow(table, getRemoveLinkFn, workItemId, claimLabel, veteranName);
                }
            }
        }
    },

    addTableRow: function (table, getRemoveLinkFn, workItemId, claimLabel, veteranName) {
        var removeLink = getRemoveLinkFn(workItemId);
        var workItemRowId = workQueueModals.getWorkItemRowId(workItemId);

        var row = '<tr id="' + workItemRowId + '">';
            //Pending Deferral
            row += '<td id="wiPendingDeferralIndicator-'+workItemId+'" style="display: none" aria-label="Pending Deferral Claim Id"></td>';
            //Claim Label
            row += '<td id="wiClaimLabel-'+workItemId+'" tabindex="0" aria-label="' + claimLabel + '">' + claimLabel + '</td>';
            //Vet
            row += '<td id="wiVeteranName-'+workItemId+'" tabindex="0" aria-label="' + veteranName + '">' + veteranName + '</td>';
            //Remove Link
            row += '<td>' + removeLink + '</td>';
        row += '</tr>';

        table.find('> tbody:last').append(row);
    },
    removeTableRow: function (workItemId, table, tableError, submitButton) {

        // Remove workItem from the modal list
        var workItemRowId = workQueueModals.getWorkItemRowId(workItemId);
        var $workItemRow = $("#" + workItemRowId);
        $workItemRow.remove();

        // Uncheck it from the Work Queue
        var checkedItems = workQueue.removeItemFromCheckedItems(workItemId);
        //since we removed a checkbox, IF this was selected by selectAll, we need to remove the selectAllCheckbox
        workQueue.checkItemsAfterLoad();
        workQueueModals.showNoticeMessage(table, $workItemRow);
        if (checkedItems.length === 0) {
            table.hide();
            tableError.show();
            submitButton.attr("disabled", "disabled");
            tableError.focus();
        } else {
            table.show();
            tableError.hide();
            table.focus();
        }

        //Defect 685398: Remove error message after claim is removed from list
        var errorId = tableError.attr('id');
        if(errorId.search("reassign") === 0) {
            $("#reassignErrorCloseMessage").click();
        } else if (errorId.search("unassign") === 0 ) {
            $("#unassignErrorCloseMessage").click();
        }
    },
    getWorkItemRowId: function (workItemId) {
        return "wqm-workItemRow-" + workItemId;
    },
    findAndFlagPendingDeferralWorkItemsForReassign: function () {
        if ($('#unassignDeferralWarningEnabled').val() !== 'true') {
            return;
        }

        var $workItemsArea = $("#reassignWorkItemsArea");
        var $warningDiv = $("#reassignPendingDeferralsWarningDiv");
        var $workItemsTable = $("#reassignWorkItemsTable");
        workQueueModals.removePendingDeferralWarningMessage($workItemsArea, $warningDiv, $workItemsTable);

        //Only flag if reassigning to "Unassigned"
        var reassignUserVal = $("#reassignUsersSelect").val();
        if (reassignUserVal == null || reassignUserVal === unassignedUserValue) {
            var $workItemsAreaLoadingMsg = $("#reassignWorkItemsAreaLoadingMsg");
            var workItemIds = workQueueModals.getWorkItemIds();
            var $workItemIdList = $warningDiv.find(".pendingDeferralsIdList");

            findAndFlagPendingDeferrals(workItemIds, $workItemsArea, $workItemsTable, $workItemsAreaLoadingMsg, $warningDiv, $workItemIdList);
        }
    },
    findAndFlagPendingDeferralWorkItemsForUnassign: function () {
        if ($('#unassignDeferralWarningEnabled').val() !== 'true') {
            return;
        }

        var $workItemsArea = $("#unassignWorkItemsArea");
        var $workItemsAreaLoadingMsg = $("#unassignWorkItemsAreaLoadingMsg");
        var $warningDiv = $("#unassignPendingDeferralsWarningDiv");
        var $workItemsTable = $("#unassignWorkItemsTable");
        var workItemIds = workQueueModals.getWorkItemIds();

        var $workItemIdList = $warningDiv.find(".pendingDeferralsIdList");

        workQueueModals.removePendingDeferralWarningMessage($workItemsArea, $warningDiv, $workItemsTable);

        findAndFlagPendingDeferrals(workItemIds, $workItemsArea, $workItemsTable, $workItemsAreaLoadingMsg, $warningDiv, $workItemIdList);
    },
    flagPendingDeferralWorkItem: function (workItemId, claimId) {
        var workItemRowId = workQueueModals.getWorkItemRowId(workItemId);
        var $workItemRow = $("#" + workItemRowId);

        var alertClass = "globalIcon-alert";
        var $indicatorTd = $workItemRow.children('[id^="wiPendingDeferralIndicator-"]');
        if ($indicatorTd.find("."+alertClass).length === 0) {
            var alertHtml = '<span class="'+alertClass+'" title="Claim '+claimId+' has pending deferral"></span>';
            $indicatorTd.text(claimId);
            $indicatorTd.prepend(alertHtml);
            $indicatorTd.css("white-space","nowrap");
        }
    },
    showPendingDeferralWorkItemColumn: function ($workItemsArea, $workItemsTable) {
        //Need more room to show the column
        var $workItemInputDiv = $workItemsArea.parent("div");
        $workItemInputDiv.css("margin-left","90px");
        var $workItemInputLabelSpan = $workItemInputDiv.parent("div").find(".workItemsInputLabel");
        $workItemInputLabelSpan.css("width","auto");

        //Show the column
        var $workItemTds = $workItemsTable.find('[id^="wiPendingDeferralIndicator-"]');
        $workItemTds.show();
    },
    hidePendingDeferralWorkItemColumn: function ($workItemsArea, $workItemsTable) {
        //Restore Div and Label sizes
        var $workItemInputDiv = $workItemsArea.parent("div");
        $workItemInputDiv.css("margin-left","150px");
        var $workItemInputLabelSpan = $workItemInputDiv.parent("div").find(".workItemsInputLabel");
        $workItemInputLabelSpan.css("width","130px");

        //Hide the column
        var $workItemTds = $workItemsTable.find('[id^="wiPendingDeferralIndicator-"]');
        $workItemTds.hide();
    },
    removePendingDeferralWarningMessage: function ($workItemsArea, $warningDiv, $workItemsTable) {
        if ($('#unassignDeferralWarningEnabled').val() !== 'true') {
            return;
        }
        $warningDiv.hide();
        $warningDiv.find(".pendingDeferralsIdList").empty();
        workQueueModals.hidePendingDeferralWorkItemColumn($workItemsArea, $workItemsTable);
    },

    showLoadingCounter: function (element, elementLoadingMsg, calculatingString, counterId) {

        var msgHTML = 'Calculating Available ' + calculatingString + '... <span id="' + counterId + 'Counter"/> <img alt="Loading Spinner" src="' + contextPathVal + '/resources_p4/images/loading.gif"/>';
        elementLoadingMsg.html(msgHTML);
        elementLoadingMsg.show();

        element.hide();
    },
    hideLoadingCounter: function (element, elementLoadingMsg) {
        elementLoadingMsg.hide();

        element.show();
    },

    showLoadingMessage: function (element, elementLoadingMsg) {

        var msgHTML = 'Loading...<img alt="Loading Spinner" src="' + contextPathVal + '/resources_p4/images/loading.gif"/>';
        elementLoadingMsg.html(msgHTML);
        elementLoadingMsg.show();

        element.hide();
    },

    hideLoadingMessage: function (element, elementLoadingMsg) {
        elementLoadingMsg.hide();

        element.show();
    },

    showOverlay: function () {
        var overlayImgPath = contextPathVal + "/resources_p4/images/loading-pdf.gif";
        $('body').append('<div id="overlayPane" aria-label="Loading..." aria-live="assertive"/><div id="overlayContent"><img aria-label="Loading Page" src="' + overlayImgPath + '" alt="Loading Spinner"/><div id="overlayContentText"/></div>');
    },

    removeContentForInternetExplorer: function(element) {
        if (element !== null) {
            for(var i = element.length - 1; i >= 0; i--) {
                if(element[i] && element[i].parentElement) {
                    element[i].parentElement.removeChild(element[i]);
                }
            }
        }
    },

	removeOverlay: function () {
        var theOverlayContent = $("#overlayContent");
        var theOverlayContentText = $("#overlayContentText");
        var theOverlayPane = $("#overlayPane");

        var isInternetExplorer = false || !!document.documentMode;
        if (isInternetExplorer) {
            workQueueModals.removeContentForInternetExplorer(theOverlayContent);
            workQueueModals.removeContentForInternetExplorer(theOverlayContentText);
            workQueueModals.removeContentForInternetExplorer(theOverlayPane);
        } else { //For all other browsers
            if (theOverlayContent !== null) {
                theOverlayContent.remove();
            }
            if (theOverlayContentText !== null) {
                theOverlayContentText.remove();
            }
            if (theOverlayPane !== null) {
                theOverlayPane.remove();
            }
		}
	},

	setIsDetails: function (val) {
		isDetails = val;
	},

	enableElement: function (element, unselectedValue) {
		element.val(unselectedValue).attr('select', true);
		element.attr('disabled', false);
		element.closest('.form-item').removeClass('hidden');
	},
	disableElement: function (element) {
		element.attr('disabled', true);
		element.attr('selectedIndex', '-1'); // Defect 92020 (ie7)
		element.find("option:selected").attr("selected", false); // Defect 92020 (non-ie7)
		element.closest('.form-item').addClass('hidden');
	},

	emptyWorkItemTable: function (table) {
		table.find("> tbody").empty();
	},

	initializeAssociatedWorkItemsTable: function(workItemId, filenumber, claimId) {
        var settings = {
            "aoColumns": [
                {  "mDataProp": "associateCheckbox", "sType": "string", bSortable: false},
                {  "mDataProp": "epCodeClaimLabel", "sType": "html", bSortable: false },
                {  "mDataProp": "status", "sType": "string", bSortable: false },
			],

            "aaSorting":[],
            "sScrollY":"170px",
            "bFilter": false,
            "bInfo":false,
            "bPaginate": false,
        };

        $.ajax( {
            dataType: 'html',
            type: 'POST',
            url: contextPathVal + "/findEligibleEpsForSupplementalWorkItemClosure",
            data: ({
                workItemId: workItemId,
                filenumber: filenumber,
                claimId: claimId
            }),
            success: function (result) {
                var $data = $(result);
                var $td = $data.find("td");
                if ($data.find("td").length == 0) {
                    $("#completeWorkItems").hide();
                    $("#completeWorkItemsLoadingMsg").hide();
				} else {
                    $("#completeWorkItems").show();
                    $("#completeWorkItemsArea").html($data);
                    //initializing the data table
                    vbmsMain.createDataTable($('#workItemSupplementalEPsTable'), settings);
                    workQueueModals.hideLoadingCounter($("#completeWorkItems"), $("#completeWorkItemsLoadingMsg"));
				}
            },
            error : function (jqXHR, textStatus, errorThrown) {
                $(".dataTables_processing").hide();
                vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown,
                    $("#completeErrorPlaceholder"),
                    $("#completeErrorDiv"),
                    workQueueModals.emptyFn);
            }
        } );

	},

	redirectToWorkQueueInbox: function (dialog, displayMessage) {
		dialog.dialog('close');
	//	$(location).attr('href', contextPathVal + "/workQueueInbox" + "?displayMessage=" + displayMessage + "&messageType=" + "info");
        $(location).attr('href', contextPathVal + "/workQueueInbox" );
	},
	reloadWorkQueueInbox: function() {
		$(location).attr('href', contextPathVal + "/workQueueInbox" );
	},
	reloadClaimDetail: function (dialog, displayMessage) {
		dialog.dialog('close');
		// Reload claim detail header and summary to reflect status change
		if (typeof claimDetailContainer !== 'undefined') {
			claimDetailContainer.reloadClaimDetailHeaderAndSummary(true, true, false);
		}
	},
	redirectToWorkItemDetails: function (dialog) {
		dialog.dialog('close');

		var workItemId = workItemDetails.getDetailWorkItemId();

		postVbmsDefaultForm('workItemDetails', {'workItemId': workItemId}, null, null);
	},

	getWorkItemIds: function () {

		var workItemIds;
		if (isDetails) {
			workItemIds = workItemDetails.getDetailWorkItemIdArray();
		} else {
			workItemIds = workQueue.getAllCheckedWorkItemsIdsPagination();
		}
		return workItemIds;
	},
	getCurrentUserId: function () {

		var currentUserId;
		if (isDetails) {
			currentUserId = workItemDetails.getDetailCurrentUserId();
		} else {
			currentUserId = workQueue.getInboxCurrentUserId();
		}
		return currentUserId;
	},
	getClaimUserId: function () {

		var currentUserId;
		if (isDetails) {
			currentUserId = claimDetail.getClaimCurrentUserId();
		} else {
			currentUserId = workQueue.getInboxCurrentUserId();
		}
		return currentUserId;
	},
	getTeamMemberUserId: function () {

		var teamMemberUserId;
		if (isDetails) {
			teamMemberUserId = workItemDetails.getDetailTeamMemberUserId();
		} else {
			teamMemberUserId = workQueue.getSelectedTeamMember();
		}
		return teamMemberUserId;
	},

	emptyFn: function () {
	},

	isInvalidNoteFormat: function (noteString, maxLength) {
        if  (maxLength === undefined){
            maxLength= 2020;
        }

		// Check if note string equals one of the note defaults, and return error based on note type.
		switch(noteString) {
			case brokerNoteDefault:
				return "Please enter a value for the brokering note.";
			case reassignNoteDefault:
				return "Please enter a value for the reassignment note.";
			case unassignNoteDefault:
				return "Please enter a value for the unassignment note.";
			case completeNoteDefault:
				return "Please enter a value for the complete assignment note.";
			case transferWorkItemDefault:
				return "Please enter a value for the transfer note.";
			default:	break;
		}

        //leaving room for system generated information here.
        if (noteString.length  > maxLength){
            return "Please limit your note to "+maxLength+ " characters. (NOTE: return key presses count as two characters against this limit)";
        }else{
            var containsOnlyValidChars = vbmsMain.extendedSafeTextRegex.test(noteString);
            if (containsOnlyValidChars){
                return null;
            } else {
                var invalidChars = vbmsMain.getInvalidChars(vbmsMain.extendedSafeTextRegex,noteString);
                return vbmsMain.getInvalidCharactersMessage(invalidChars);
            }
        }
	},

	// Check if the note is empty, and continue based on the ID of the note field
	isEmptyNote: function (noteString, noteID, maxLength) {
		if (noteString.trim() == "") {
			// Change the string based on ID to the default for that note type
			switch(noteID) {
				case "transferNote":
					noteString = transferWorkItemDefault;
					break;
				case "brokerNote":
					noteString = brokerNoteDefault;
					break;
				case "unassignNote":
					noteString = unassignNoteDefault;
					break;
				case "reassignNote":
					noteString = reassignNoteDefault;
					break;
				case "completeNote":
					noteString = completeNoteDefault;
					break;
				default:
					return workQueueModals.isInvalidNoteFormat(noteString, maxLength);
			}
		}
		// return if the note is invalid
		return workQueueModals.isInvalidNoteFormat(noteString,maxLength);
	},

	completeOrCloseWorkItemAjaxSuccess: function (ajaxResponse) {
		// Determine redirect function based on context
		var redirectFunction;
		if (typeof claimDetailContainer !== 'undefined') {
			// On claim detail page - reload the claim detail instead of redirecting to work queue
			redirectFunction = workQueueModals.reloadClaimDetail;
		} else {
			// On work queue page - redirect to inbox as usual
			redirectFunction = workQueueModals.redirectToWorkQueueInbox;
		}
		
		workQueueModals.ajaxSuccess(
				ajaxResponse,
				redirectFunction,
				true,
				$("#completeWorkItemModal"),
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"));
	},

    completeOrCloseWorkItemAjaxError: function (jqXHR, textStatus, errorThrown) {
		$("#completeSubmitButton").removeAttr("disabled");

		if($("#promptUserOpenESR").dialog('isOpen') === true){
			$("#promptUserOpenESR").dialog('close');
		}

		vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown,
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"),
				workQueueModals.emptyFn);
	},

	showNoticeMessage: function($table, $workItem){
		if($table.attr("id") == "reassignWorkItemsTable"){
			workQueueModals.showWorkItemNoticeMessage($workItem, $("#reassignWorkItemsNotice"));
		}else if($table.attr("id") == "assignToMeWorkItemsTable"){
			workQueueModals.showWorkItemNoticeMessage($workItem, $("#assignToMeWorkItemsNotice"));
		}else if($table.attr("id") == "unassignWorkItemsTable"){
			workQueueModals.showWorkItemNoticeMessage($workItem, $("#unassignWorkItemsNotice"));
            // Enable submit button so user can take action.
            $("#unassignSubmitButton").removeAttr("disabled");
		}else if($table.attr("id") == "brokerWorkItemsTable"){
			workQueueModals.showWorkItemNoticeMessage($workItem, $("#brokerWorkItemsNotice"));
		}
	},

	showWorkItemNoticeMessage: function($workItem, $workItemNotice){
		//if the remove button is clicked in quick secession we want to hide the old message before updating it.
		$workItemNotice.hide();

		var workItemName = $workItem.children('[id^="wiClaimLabel-"]').text();
		var workItemVet = $workItem.children('[id^="wiVeteranName-"]').text();
		var noticeMessage = "Work Item " + workItemName + " for Veteran " + workItemVet + " has been removed from the Work Items list.";

		$workItemNotice.text(noticeMessage);
		$workItemNotice.slideDown();
		setTimeout($workItemNotice.slideUp.bind($workItemNotice), 5000);
	}
};

/*
 ******************
 * AJAX Functions *
 ******************
 */

function completeWorkItem(workItemId, fileNumber, claimStatus, userId, teamId, note, associatedClaimIds, specialMissionId) {
	$.ajax({
		url: contextPathVal + '/completeWorkItem',
        type: "POST",
		dataType: "json",
		overlayFunction: workQueueModals.showOverlay,
		data: {
			workItemId: workItemId,
			fileNumber: fileNumber,
			claimStatus: claimStatus,
			userId: userId,
            teamId: teamId,
			note: note,
			associatedClaimIds: associatedClaimIds,
			specialMissionID: specialMissionId
		},
		success: workQueueModals.completeOrCloseWorkItemAjaxSuccess,
		error: workQueueModals.completeOrCloseWorkItemAjaxError
	});
}

function closeWorkItem(workItemId, fileNumber, claimStatus, closeReason, note, associatedClaimIds) {
	$.ajax({
		url: contextPathVal + '/closeWorkItem',
        type: "POST",
		dataType: "json",
		data: {
			workItemId: workItemId,
			fileNumber: fileNumber,
			claimStatus: claimStatus,
			closeReason: closeReason,
			note: note,
            associatedClaimIds: associatedClaimIds
		},
		success: workQueueModals.completeOrCloseWorkItemAjaxSuccess,
		error: workQueueModals.completeOrCloseWorkItemAjaxError
	});
}


function reassignWorkItems(workItemIds, note, priority, specialMissionId, group, userId, userName) {
	$.ajax({
		url: contextPathVal + '/reassignWorkItems',
        type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
			note: note,
			priority: priority,
			specialMissionId: specialMissionId,
			groupId: group,
			userId: userId
		},
		success: function (ajaxResponse) {
            $("#reassignErrorDiv").hide(); // Hide error div since warning div is only div potentially used in success
			
			// NOTE: reassignWorkItems dialog has a slightly different behavior from
			// a typical dialog. Hence the use of a custom ajax handler instead of
			// simply using ajaxSuccess
			workQueueModals.ajaxReassignWorkItems(
				ajaxResponse,
				workQueueModals.redirectToWorkQueueInbox,
				true,
				$("#reassignWorkItemModal"),
				$("#reassignRestrictedItemsWarningDiv"),
			    { id: userId, username: userName});
		},
		error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestError(jqXHR, textStatus, errorThrown, $("#reassignErrorPlaceholder"),$("#reassignErrorDiv"));
            $("#reassignRestrictedItemsWarningDiv").hide();
		}
	});
}

function unassignWorkItems(workItemIds, note, priority) {
	$.ajax({
		url: contextPathVal + '/unassignWorkItems',
        type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
			note: note,
			priority: priority
		},
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.redirectToWorkQueueInbox,
				true,
				$("#unassignWorkItemModal"),
				$("#unassignErrorPlaceholder"),
				$("#unassignErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestError(jqXHR, textStatus, errorThrown, $("#unassignErrorPlaceholder"),$("#unassignErrorDiv"));
			$("#unassignRestrictedItemsWarningDiv").hide();
			$("#unassignRestrictedWorkItemIdList").empty();
		}
	});
}

function updatePriorityForWorkItems(workItemIds, priority) {
	$.ajax({
		url: contextPathVal + "/updatePriorityForWorkItems",
        type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
			priority: priority
		},
		success: function (ajaxResponse) {
			var redirectFunction;
			if (isDetails) {
				redirectFunction = workQueueModals.redirectToWorkItemDetails;
			} else {
				redirectFunction = workQueueModals.redirectToWorkQueueInbox;
			}

			workQueueModals.ajaxSuccess(
				ajaxResponse,
				redirectFunction,
				true,
				$("#updateWorkItemPriorityModal"),
				$("#updatePriorityErrorPlaceholder"),
				$("#updatePriorityErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestError(jqXHR, textStatus, errorThrown, $("#updatePriorityErrorPlaceholder"), $("#updatePriorityErrorDiv"));
			$("#updatePriorityRestrictedItemsWarningDiv").hide();
			$("#updatePriorityRestrictedWorkItemIdList").empty();

		}
	});
}

function assignWorkItemsToMe(workItemIds, groupId) {
	$.ajax({
		url: contextPathVal + '/assignWorkItemsToMe',
        type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
			groupId: groupId
		},
		success: function (ajaxResponse) {
            workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.redirectToWorkQueueInbox,
				true,
				$("#assignWorkItemToMeModal"),
				$("#assignToMeErrorPlaceholder"),
				$("#assignToMeErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestError(jqXHR, textStatus, errorThrown, $("#assignToMeErrorPlaceholder"), $("#assignToMeErrorDiv"));
			$("#assignToMeRestrictedItemsWarningDiv").hide();
			$("#assignToMeRestrictedWorkItemIdList").empty();
		}
	});
}

function brokerWorkItemsViaRegionalOffice(workItemIds, roStationNumber, note) {
	$.ajax({
		url: contextPathVal + '/brokerWorkItems',
        type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
			roStationNumber: roStationNumber,
			note: note
		},
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.redirectToWorkQueueInbox,
				true,
				$("#brokerWorkItemModal"),
				$("#brokerErrorPlaceholder"),
				$("#brokerErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				$("#brokerErrorPlaceholder"),
				$("#brokerErrorDiv"),
				workQueueModals.emptyFn);
		}
	});
}

function nwqTransferClaims(workItemIds, stationNumber, locationId, locationType, note) {

    var location = {};
    location.locationType = locationType;
    if (locationType == 'REGIONAL_OFFICE') {
        location.stationNumber = stationNumber;
        if (stationNumber != locationId) {
            location.specialMissionId = locationId;
        } else {
            location.specialMissionId = "0";
        }
    } else {
        location.stationNumber = "";
        location.specialMissionId = "0";
    }

    $.ajax({
        url: contextPathVal + '/transferClaimsUsingWorkItems',
        type: "POST",
        dataType: "json",
        data: {
            workItemIds: workItemIds,
            nwqTransferLocation: JSON.stringify(location),
            note: note
        },
        success: function (ajaxResponse) {
            workQueueModals.ajaxSuccess(
                ajaxResponse,
                workQueueModals.redirectToWorkQueueInbox,
                true,
                $("#nwqTransferClaimsModal"),
                $("#nwqTransferClaimsErrorPlaceholder"),
                $("#nwqTransferClaimsErrorDiv"));
        },
        error: function (jqXHR, textStatus, errorThrown) {
            workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
                $("#nwqTransferClaimsErrorPlaceholder"),
                $("#nwqTransferClaimsErrorDiv"),
                workQueueModals.emptyFn);
        }
    });
}

function brokerDivision(workItemIds, stationNumber, locationId, note) {
	$.ajax({
		url: contextPathVal + '/brokerWorkItemsViaInternalClaimAuthority',
		type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
			internalClaimAuthorityId: locationId,
			note: note
		},
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.redirectToWorkQueueInbox,
				true,
				$("#brokerWorkItemModal"),
				$("#brokerErrorPlaceholder"),
				$("#brokerErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				$("#brokerErrorPlaceholder"),
				$("#brokerErrorDiv"),
				workQueueModals.emptyFn);
		}
	});
}

function updateTeamAssignmentForWorkItems(workItemIds, group) {
	$.ajax({
		url: contextPathVal + '/updateTeamAssignmentForWorkItems',
        type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
			groupId: group
		},
		success: function (ajaxResponse) {

			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.redirectToWorkQueueInbox,
				true,
				$("#changeTeamAssignmentModal"),
				$("#changeTeamAssignmentErrorPlaceholder"),
				$("#changeTeamAssignmentErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestError(jqXHR, textStatus, errorThrown, $("#changeTeamAssignmentErrorPlaceholder"), $("#changeTeamAssignmentErrorDiv"));
			$("#changeTeamAssignmentRestrictedItemsWarningDiv").hide();
			$("#changeTeamAssignmentRestrictedWorkItemIdList").empty();
		}
	});
}

function populateClaimCloseReasons(claimStatus) {
	$.ajax({
		url: contextPathVal + "/populateClaimCloseReasons",
        type: "POST",
		dataType: "json",
		data: {
			claimStatus: claimStatus
		},
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.displayClaimCloseReasons,
				false,
				$("#completeWorkItemModal"),
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"),
				workQueueModals.emptyFn);
		}
	});
}

function checkForPendingUploads(fileNumber) {
	var uploadPending = false;
    $.ajax({
        url: contextPathVal + "/checkForPendingUploads",
        type: "POST",
        dataType: "json",
        async: false,
        data: {
            fileNumber: fileNumber
        },
        success: function (ajaxResponse) {
            if(ajaxResponse['data']){
                $("#pendingUploadWarning").show();
                uploadPending = true;
            }
        }
    });

    return uploadPending;
}

function removePendingUploadIndicator(fileNumber) {
	$.ajax({
		url: contextPathVal + '/removePendingUpload',
		type: "POST",
		dataType: "json",
		data: {
			fileNumber: fileNumber
		},
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.redirectToWorkQueueInbox,
				true,
				$("#removePendingDialogModal"),
				$("#removePendingErrorPlaceholder"),
				$("#removePendingErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			vbmsMain.ajaxModalRequestError(jqXHR, textStatus, errorThrown, $("#removePendingErrorPlaceholder"), $("#removePendingErrorDiv"));
		}
	});
}

function checkForDeferrals(workItemId, fileNumber) {
    $.ajax({
        url: contextPathVal + "/completeWorkItemDeferralsValidation",
        type: "POST",
        dataType: "json",
        data: {
            workItemId: workItemId,
			fileNumber: fileNumber
        },
        success: function (ajaxResponse) {
			if(ajaxResponse.success) {
				$("#completeSubmitButton").removeAttr('disabled').removeClass('ui-state-disabled');
				$("#completionClaimStatusesSelect").removeAttr('disabled');
				$("#completeNote").removeAttr('disabled');
			}
			else {
				$("#completeSubmitButton").attr('disabled', 'disabled').addClass('ui-state-disabled');
				$("#completionClaimStatusesSelect").attr('disabled', 'disabled');
				$("#completeNote").attr('disabled', 'disabled');
				$("#deferralError").show();
				document.getElementById('deferralError').innerHTML = "Error:\n"+ajaxResponse['data']
			}
        },
		error: function(jqXHR, textStatus, errorThrown) {
			vbmsMain.ajaxRequestError(jqXHR, textStatus, errorThrown);
		}
    });
}

function populateClaimStatusesForCompletion(uploadPending, workItemId) {
	$.ajax({
		url: contextPathVal + "/populateClaimStatusesForCompletion",
        type: "POST",
		dataType: "json",
        data: {
            uploadPending: uploadPending,
			workItemId: workItemId
        },
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.displayClaimStatusesForCompletion,
				false,
				$("#completeWorkItemModal"),
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"),
				workQueueModals.emptyFn);
		}
	});
}

function populateRegionalOfficesForBrokering() {
	$.ajax({
		url: contextPathVal + "/populateRegionalOfficesForBrokering",
        type: "POST",
		dataType: "json",
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.displayRegionalOfficesForBrokering,
				false,
				$("#brokerWorkItemModal"),
				$("#brokerErrorPlaceholder"),
				$("#brokerErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				$("#brokerErrorPlaceholder"),
				$("#brokerErrorDiv"),
				workQueueModals.emptyFn);
		}
	});
}

function populateLocationsForNwqTransferClaimsModal() {
    $.ajax({
        url: contextPathVal + "/populateLocationsForNwqTransferClaimsModal",
        type: "POST",
        dataType: "json",
        success: function (ajaxResponse) {
            nwqTransferLocationLabels
            workQueueModals.ajaxSuccess(
                ajaxResponse,
                workQueueModals.displayLocationsForNwqTransferClaimsModal,
                false,
                $("#nwqTransferClaimsModal"),
                $("#nwqTransferClaimsErrorPlaceholder"),
                $("#nwqTransferClaimsErrorDiv"));
        },
        error: function (jqXHR, textStatus, errorThrown) {
            workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
                $("#nwqTransferClaimsErrorPlaceholder"),
                $("#nwqTransferClaimsErrorDiv"),
                workQueueModals.emptyFn);
        }
    });
}
function populateLocationsForReassignClaimsModal() {
	$.ajax({
		url: contextPathVal + "/populateLocationsForReassignClaimsModal",
		type: "POST",
		dataType: "json",
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.displayLocationsForReassignClaimsModal,
				false,
				$("#reassignClaimsModal"),
				$("#reassignClaimsErrorPlaceholder"),
				$("#reassignClaimsErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				$("#reassignClaimsErrorPlaceholder"),
				$("#reassignClaimsErrorDiv"),
				workQueueModals.emptyFn);
		}
	});
}

function populateLocationsForClaimAuthoritiesModal() {
	var errorPlaceholder = $("#brokerErrorPlaceholder");
	var errorDiv = $("#brokerErrorDiv");
	$.ajax({
		url: contextPathVal + "/populateBrokerClaimAuthoritiesModal",
		type: "POST",
		dataType: "json",
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.displayLocationsForClaimAuthoritiesModal,
				false,
				$("#brokerWorkItemModal"),
				errorPlaceholder,
				errorDiv);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				errorPlaceholder,
				errorDiv,
				workQueueModals.emptyFn);
		}
	});
}

function populateLocationsForValidClaimLocationsModal() {
	var errorPlaceholder = $("#completeErrorPlaceholder");
	var errorDiv = $("#completeErrorDiv");
	$.ajax({
		url: contextPathVal + "/populateCompleteWorkItemModalTypeahead",
		type: "POST",
		dataType: "json",
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.displayValidLocationsForCompleteWorkItemModal,
				false,
				$("#completeWorkItemModal"),
				errorPlaceholder,
				errorDiv);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				errorPlaceholder,
				errorDiv,
				workQueueModals.emptyFn);
		}
	});
}

function populateWorkItemPriorities(displayFunction, modal, errorPlaceholder, errorDiv) {
	$.ajax({
		url: contextPathVal + "/populateWorkItemPriorities",
        type: "POST",
		dataType: "json",
		data: {
		},
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				displayFunction,
				false,
				modal,
				errorPlaceholder,
				errorDiv);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				errorPlaceholder,
				errorDiv,
				workQueueModals.emptyFn);
		}
	});
}

function populateUsersForCompletion(workItemId, claimStatus) {
	$.ajax({
		url: contextPathVal + "/populateUsersForCompletion",
        type: "POST",
		dataType: "json",
		data: {
			workItemId: workItemId,
			claimStatus: claimStatus
		},
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				workQueueModals.displayUsersForCompletion,
				false,
				$("#completeWorkItemModal"),
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"));
		},
		error: function (jqXHR, textStatus, errorThrown) {
			workQueueModals.ajaxError(jqXHR, textStatus, errorThrown,
				$("#completeErrorPlaceholder"),
				$("#completeErrorDiv"),
				workQueueModals.displayUnassignUserForCompletion);
		}
	});
}

// Added for defect 648447 to allow the user to unselect a team, keep the currently selected user for reassignement
//while reloading the list of users and the list of teams. Otherwise the list of teams would reload the user list would
//still only contain users for the previously selected team.
function populateUsersForReassign(team, workItemIds, selectedUser) {

    currentRequest = $.ajax({
        url: contextPathVal + "/populateUsersForReassign",
        type: "POST",
        dataType: "json",
        data: {
			teamId: team,
            workItemIds: workItemIds
        },
		beforeSend : function()    {
			if(currentRequest != null) {
				currentRequest.abort();
			}
		},
        success: function (ajaxResponse) {
            workQueueModals.displayUsersForReassign(ajaxResponse, selectedUser);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown, $("#reassignErrorPlaceholder"), $("#reassignErrorDiv"), workQueueModals.displayUnassignUserForReassign);
        }
    });
}

function populateTeamsForUser(userId, displaySuccessFunction, displayErrorFunction, modal, errorPlaceholder, errorDiv) {
	$.ajax({
		url: contextPathVal + "/populateTeamsAndMembersForUser",
        type: "POST",
		dataType: "json",
		data: {
			userId: userId
		},
		success: function (ajaxResponse) {
            workQueueModals.ajaxSuccess(
                ajaxResponse,
                displaySuccessFunction,
                false,
                modal,
                errorPlaceholder,
                errorDiv);
		},
		error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown, errorPlaceholder, errorDiv, displayErrorFunction);
		}
	});
}

function displayExportWorkQueueModal(userId, displaySuccessFunction, displayErrorFunction, modal, errorPlaceholder, errorDiv) {
    $.ajax({
        url: contextPathVal + "/displayExportWorkQueue",
        type: "POST",
        dataType: "json",
        data: {
            userId: userId
        },
        success: function (ajaxResponse) {
            workQueueModals.ajaxSuccess(
                ajaxResponse,
                displaySuccessFunction,
                false,
                modal,
                errorPlaceholder,
                errorDiv);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown, errorPlaceholder, errorDiv, displayErrorFunction);
        }
    });
}

function populateTeamsForUserReassign(userId,displayErrorFunction, errorPlaceholder, errorDiv,
                              selectedTeamValue) {
    $.ajax({
        url: contextPathVal + "/populateTeamsAndMembersForUser",
        type: "POST",
        dataType: "json",
        data: {
            userId: userId
        },
        success: function (ajaxResponse) {
        	// Defect 674513: Team selection will auto populate on reassignment modal only if the user selected is assigned to one team
            var dataList = ajaxResponse.data;
        	if(dataList.length == 1){
        		selectedTeamValue = dataList[0].id;
        	}
        	
            workQueueModals.displayTeamsForReassignBasedOnUser(ajaxResponse, selectedTeamValue);
        },
        error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown, errorPlaceholder, errorDiv, displayErrorFunction);
        }
    });
}

function populateAllTeamsForCurrentRO(displaySuccessFunction, displayErrorFunction, modal, errorPlaceholder, errorDiv) {
	$.ajax({
		url: contextPathVal + "/populateAllTeamsForCurrentRO",
        type: "POST",
		dataType: "json",
		success: function (ajaxResponse) {
			workQueueModals.ajaxSuccess(
				ajaxResponse,
				displaySuccessFunction,
				false,
				modal,
				errorPlaceholder,
				errorDiv);
		},
		error: function (jqXHR, textStatus, errorThrown) {
            vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown, errorPlaceholder, errorDiv, displayErrorFunction);
		}
	});
}

function countNumOfNonTermESR(claimId, displayErrorFunction, errorPlaceholder, errorDiv, nonTermESRNum) {
	$.ajax({
		url: contextPathVal + "/examServices/getNumberOfPendingExamRequestsWithoutAuthorization",
		type: "POST",
		dataType: "json",
		data: {
			claimId: claimId
		},
		success: function (ajaxResponse) {
			nonTermESRNum(ajaxResponse);
		},
		error: function (jqXHR, textStatus, errorThrown) {
			vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown, errorPlaceholder, errorDiv, displayErrorFunction);
		}
	});
}

function auditUserPromptChoice(claimId, action, displayErrorFunction, errorPlaceholder, errorDiv) {
	$.ajax({
		url: contextPathVal + "/examServices/logClaimStatus",
		type: "POST",
		dataType: "json",
		data: {
			claimId: claimId,
			action: action
		},
		success: function (ajaxResponse) {
			// nothing required here
		},
		error: function (jqXHR, textStatus, errorThrown) {
			vbmsMain.ajaxModalRequestErrorFunction(jqXHR, textStatus, errorThrown, errorPlaceholder, errorDiv, displayErrorFunction);
		}
	});
}

function findAndRemoveUnauthorizedWorkItemsForUpdatePriority() {

	var ajaxUrl = contextPathVal + '/findUnathorizedWorkItemsForUpdatePriority';
	var $workItemsArea = $("#updatePriorityWorkItemsArea");
	var $workItemsAreaLoadingMsg = $("#updatePriorityWorkItemsAreaLoadingMsg");
	var $restrictedItemsWarningDiv = $("#updatePriorityRestrictedItemsWarningDiv");
	var $restrictedWorkItemIdList = $("#updatePriorityRestrictedWorkItemIdList");
	var workItemIds = workQueueModals.getWorkItemIds();
	var removeWorkItemTableRowFunction = workQueueModals.removeUpdatePriorityWorkItemsTableRow;


	findAndRemoveUnauthorizedWorkItemsForAssignmentTypeAction(ajaxUrl, workItemIds, $workItemsArea, $workItemsAreaLoadingMsg,
		$restrictedItemsWarningDiv, $restrictedWorkItemIdList, removeWorkItemTableRowFunction);

}

function findAndRemoveUnauthorizedWorkItemsForChangeTeamAssignment() {

	var ajaxUrl = contextPathVal + '/findUnathorizedWorkItemsForChangeTeamAssignment';
	var $workItemsArea = $("#changeTeamAssignmentWorkItemsArea");
	var $workItemsAreaLoadingMsg = $("#changeTeamAssignmentPriorityWorkItemsAreaLoadingMsg");
	var $restrictedItemsWarningDiv = $("#changeTeamAssignmentRestrictedItemsWarningDiv");
	var $restrictedWorkItemIdList = $("#changeTeamAssignmentRestrictedWorkItemIdList");
	var workItemIds = workQueueModals.getWorkItemIds();
	var removeWorkItemTableRowFunction = workQueueModals.removeUpdatePriorityWorkItemsTableRow;


	findAndRemoveUnauthorizedWorkItemsForAssignmentTypeAction(ajaxUrl, workItemIds, $workItemsArea, $workItemsAreaLoadingMsg,
			$restrictedItemsWarningDiv, $restrictedWorkItemIdList, removeWorkItemTableRowFunction);

}

function findAndRemoveUnauthorizedWorkItemsForAssignToMe() {

	var ajaxUrl = contextPathVal + '/findUnathorizedWorkItemsForAssign';
	var $workItemsArea = $("#assignToMeWorkItemsArea");
	var $workItemsAreaLoadingMsg = $("#assignToMeWorkItemsAreaLoadingMsg");
	var $restrictedItemsWarningDiv = $("#assignToMeRestrictedItemsWarningDiv");
	var $restrictedWorkItemIdList = $("#assignToMeRestrictedWorkItemIdList");
	var workItemIds = workQueueModals.getWorkItemIds();
	var removeWorkItemTableRowFunction = workQueueModals.removeAssignToeMeWorkItemsTableRow;


	findAndRemoveUnauthorizedWorkItemsForAssignmentTypeAction(ajaxUrl, workItemIds, $workItemsArea, $workItemsAreaLoadingMsg,
		$restrictedItemsWarningDiv, $restrictedWorkItemIdList, removeWorkItemTableRowFunction);

}

function findAndRemoveUnauthorizedWorkItemsForReassign() {

	var ajaxUrl = contextPathVal + '/findUnathorizedWorkItemsForReassign';
	var $workItemsArea = $("#reassignWorkItemsArea");
	var $workItemsAreaLoadingMsg = $("#reassignWorkItemsAreaLoadingMsg");
	var $restrictedItemsWarningDiv = $("#reassignRestrictedItemsWarningDiv");
	var workItemIds = workQueueModals.getWorkItemIds();
	var removeWorkItemTableRowFunction = workQueueModals.removeReassignWorkItemsTableRow;


	findAndRemoveUnauthorizedWorkItemsForAssignmentTypeAction(ajaxUrl, workItemIds, $workItemsArea, $workItemsAreaLoadingMsg,
		$restrictedItemsWarningDiv, removeWorkItemTableRowFunction);

}

function findAndRemoveUnauthorizedWorkItemsForUnassign() {

	var ajaxUrl = contextPathVal + '/findUnathorizedWorkItemsForUnassign';
	var $workItemsArea = $("#unassignWorkItemsArea");
	var $workItemsAreaLoadingMsg = $("#unassignWorkItemsAreaLoadingMsg");
	var $restrictedItemsWarningDiv = $("#unassignRestrictedItemsWarningDiv");
	var $restrictedWorkItemIdList = $("#unassignRestrictedWorkItemIdList");
	var workItemIds = workQueueModals.getWorkItemIds();
	var removeWorkItemTableRowFunction = workQueueModals.removeUnassignWorkItemsTableRow;


	findAndRemoveUnauthorizedWorkItemsForAssignmentTypeAction(ajaxUrl, workItemIds, $workItemsArea, $workItemsAreaLoadingMsg,
		$restrictedItemsWarningDiv, $restrictedWorkItemIdList, removeWorkItemTableRowFunction);
}

function findAndRemoveUnauthorizedWorkItemsForAssignmentTypeAction(ajaxUrl, workItemIds, workItemsArea, workItemsAreaLoadingMsg,
											  restrictedItemsWarningDiv, restrictedWorkItemIdList, removeWorkItemTableRowFunction) {

	workQueueModals.showLoadingMessage(workItemsArea, workItemsAreaLoadingMsg);

	$.ajax({
		url: ajaxUrl,
		type: "POST",
		dataType: "json",
		data: {
			workItemIds: workItemIds,
		},
		success: function (ajaxResponse) {
			var unauthorizedWorkItemIds = ajaxResponse['data'];
			if(typeof unauthorizedWorkItemIds != "undefined" && unauthorizedWorkItemIds != null && unauthorizedWorkItemIds.length > 0){
				var workIdsListHtml = "<ul>";
				for (var i = 0; i < unauthorizedWorkItemIds.length; i++) {
					removeWorkItemTableRowFunction(unauthorizedWorkItemIds[i]);
					workIdsListHtml += "<li>" + unauthorizedWorkItemIds[i] + "</li>";
				}
				workIdsListHtml += "</ul>";
				restrictedWorkItemIdList.append(workIdsListHtml);
				restrictedItemsWarningDiv.show();

			}
			workQueueModals.hideLoadingMessage(workItemsArea, workItemsAreaLoadingMsg);
            workQueueModals.removeOverlay();
		},
		error: function (jqXHR, textStatus, errorThrown) {

			workQueueModals.hideLoadingMessage(workItemsArea, workItemsAreaLoadingMsg);
            workQueueModals.removeOverlay();
		}
	});
}

function findAndFlagPendingDeferrals(workItemIds, workItemsArea, workItemsTable, workItemsAreaLoadingMsg,
                                     warningDiv, workItemIdList) {

    if (workItemIds.length === 0) {
        return;
    }
    workQueueModals.showLoadingMessage(workItemsArea, workItemsAreaLoadingMsg);

    $.ajax({
        url: contextPathVal + '/findPendingDeferrals',
        type: "POST",
        dataType: "json",
        data: { workItemIds: workItemIds },
        async: false,
        success: function (ajaxResponse) {
            if (ajaxResponse.success) {
                var deferralWorkItemIdMap = ajaxResponse['data'];
                if (typeof deferralWorkItemIdMap != "undefined" && deferralWorkItemIdMap != null &&
                        Object.keys(deferralWorkItemIdMap).length !== 0) {

                    var workIdsListHtml = "<ul>";
                    for (var key in deferralWorkItemIdMap) {
                        workQueueModals.flagPendingDeferralWorkItem(key, deferralWorkItemIdMap[key]);
                        workIdsListHtml += "<li>" + deferralWorkItemIdMap[key] + "</li>";
                    }
                    workIdsListHtml += "</ul>";
                    workItemIdList.append(workIdsListHtml);
                    warningDiv.show();
                    workQueueModals.showPendingDeferralWorkItemColumn(workItemsArea, workItemsTable);
                }
            }
        },
        complete: function () {
            workQueueModals.hideLoadingMessage(workItemsArea, workItemsAreaLoadingMsg);
            workQueueModals.removeOverlay();
        }
    });
}

//Remove malicious tokens from HTTP/Ajax/XMLHttp responses using a blacklist of unacceptable tokens
function sanitizeResponseValues(responseValue, expectedValue) {
	//Turn the responseValue into a string so that we can use regex matching AND because we only need to clean up
	// malicious tokens when the expected return value is a string...
	var sanitizedResponseValue = responseValue.toString();

	//Blacklist unacceptable tokens in the response value based on the expectedValue (e.g. number, string)
	switch (expectedValue)
	{
		case "number":
			//Numbers/Digits only. Anything not a digit is replaced
			sanitizedResponseValue.replace(/\D/g, "");
			break;
		case "string":
			//Remove new lines and carriage returns
            sanitizedResponseValue.replace(/(\\r\\n|\\n|\\r|%0d|%0a)/g, "");
			break;
		default:
			break;
	}

	//Return the expected response as a string, noting that this function is only used when values are turned into strings
    return sanitizedResponseValue;
}

function handleRegionalOfficeBrokering(regionalOfficesSelect, brokerSubmitButton, brokerNoteVal) {
	var roStationNumber = regionalOfficesSelect.val();
	if (roStationNumber === unselectedOptionValue) {
		showErrorForBrokering(brokerSubmitButton, "Please select a Regional Office.");
	} else {
		var workItemIds = workQueueModals.getWorkItemIds();
		brokerWorkItemsViaRegionalOffice(workItemIds, roStationNumber, brokerNoteVal);
	}
}

function handleDivisionBrokering(brokerSubmitButton, brokerNoteVal) {
	var locationLabel = $("#claimAuthoritiesTypeahead").val();
	if (locationLabel == null || locationLabel === "") {
		showErrorForBrokering(brokerSubmitButton, emptyDivisionBrokeringLocation);
	} else {
		var validLocation = checkForValidLocation(claimAuthoritiesLabels, locationLabel);
		if (validLocation) {
			handleValidDivisionBrokering(brokerSubmitButton, locationLabel, brokerNoteVal);
		} else {
			showErrorForBrokering(brokerSubmitButton, invalidDivisionBrokeringLocation);
		}
	}
}

function handleValidDivisionBrokering(brokerSubmitButton, locationLabel, brokerNoteVal) {
	var locationId = $("#claimAuthoritiesTypeaheadValue").val();
	var stationNumber = locationLabel.slice(0, locationLabel.indexOf("-") - 1);
	if (!isNaN(stationNumber) && !isNaN(locationId)) {
		var workItemIds = workQueueModals.getWorkItemIds();
		if (Number(stationNumber) === Number(locationId)) {
			brokerWorkItemsViaRegionalOffice(workItemIds, stationNumber, brokerNoteVal);
		} else {
			brokerDivision(workItemIds, stationNumber, locationId, brokerNoteVal);
		}
	} else {
		showErrorForBrokering(brokerSubmitButton, invalidDivisionBrokeringLocation);
	}
}

function showErrorForBrokering(brokerSubmitButton, error) {
	brokerSubmitButton.removeAttr("disabled");
	$("#brokerErrorPlaceholder").html(error);
	$("#brokerErrorDiv").show();
	workQueueModals.removeOverlay();
}
