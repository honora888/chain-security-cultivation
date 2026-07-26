// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {GuardianQuest} from "../src/GuardianQuest.sol";

contract GuardianQuestTest is Test {
    GuardianQuest internal guardian;

    address internal admin;
    address internal verifier;
    address internal learner;
    address internal funder;
    address internal recipient;

    uint256 internal constant QUEST_ID = 1;

    bytes32 internal constant CONTENT_HASH = keccak256("reentrancy-quest-v1");

    bytes32 internal constant REPORT_HASH = keccak256("learner-audit-report-v1");

    string internal constant METADATA_URI = "https://example.com/metadata/1.json";

    function setUp() public {
        admin = makeAddr("admin");
        verifier = makeAddr("verifier");
        learner = makeAddr("learner");
        funder = makeAddr("funder");
        recipient = makeAddr("recipient");

        // 部署时将 admin 设为管理员和初始验证者
        guardian = new GuardianQuest(admin);

        // startPrank 会持续模拟 admin，
        // 不会因为中间调用 VERIFIER_ROLE() 而提前失效。
        vm.startPrank(admin);

        guardian.grantRole(guardian.VERIFIER_ROLE(), verifier);

        guardian.registerQuest(QUEST_ID, CONTENT_HASH, METADATA_URI);

        vm.stopPrank();

        // 给资助者准备本地测试资金
        vm.deal(funder, 10 ether);
    }

    /// @notice 注册后，关卡信息应正确保存
    function testQuestIsRegistered() public view {
        (bytes32 contentHash, string memory metadataURI, bool active, uint256 totalFunded) = guardian.quests(QUEST_ID);

        assertEq(contentHash, CONTENT_HASH);
        assertEq(metadataURI, METADATA_URI);
        assertTrue(active);
        assertEq(totalFunded, 0);

        assertEq(guardian.uri(QUEST_ID), METADATA_URI);
    }

    /// @notice 验证者可以存证报告并铸造勋章
    function testVerifierAnchorsReportAndMintsBadge() public {
        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        assertTrue(guardian.completed(QUEST_ID, learner));

        assertEq(guardian.reportHashes(QUEST_ID, learner), REPORT_HASH);

        assertEq(guardian.balanceOf(learner, QUEST_ID), 1);
    }

    /// @notice 同一关卡不能重复领取勋章
    function testCannotCompleteQuestTwice() public {
        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        vm.expectRevert(abi.encodeWithSelector(GuardianQuest.AlreadyCompleted.selector, QUEST_ID, learner));

        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);
    }

    /// @notice 未获授权的地址不能验证完成结果
    function testUnauthorizedAddressCannotVerify() public {
        vm.expectRevert();

        vm.prank(funder);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        assertEq(guardian.balanceOf(learner, QUEST_ID), 0);
    }

    /// @notice 勋章不能在普通用户之间转移
    function testBadgeCannotBeTransferred() public {
        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);

        vm.expectRevert(GuardianQuest.BadgeNonTransferable.selector);

        vm.prank(learner);
        guardian.safeTransferFrom(learner, funder, QUEST_ID, 1, "");

        assertEq(guardian.balanceOf(learner, QUEST_ID), 1);

        assertEq(guardian.balanceOf(funder, QUEST_ID), 0);
    }

    /// @notice 开放中的挑战可以接收测试资助
    function testQuestCanReceiveFunding() public {
        vm.prank(funder);
        guardian.fundQuest{value: 2 ether}(QUEST_ID);

        (,,, uint256 totalFunded) = guardian.quests(QUEST_ID);

        assertEq(totalFunded, 2 ether);

        assertEq(address(guardian).balance, 2 ether);
    }

    /// @notice 管理员可以提取指定挑战的测试资助
    function testAdminCanWithdrawQuestFunds() public {
        vm.prank(funder);
        guardian.fundQuest{value: 2 ether}(QUEST_ID);

        uint256 recipientBalanceBefore = recipient.balance;

        vm.prank(admin);
        guardian.withdrawQuestFunds(QUEST_ID, payable(recipient), 1 ether);

        (,,, uint256 remainingFunding) = guardian.quests(QUEST_ID);

        assertEq(remainingFunding, 1 ether);

        assertEq(recipient.balance, recipientBalanceBefore + 1 ether);

        assertEq(address(guardian).balance, 1 ether);
    }

    /// @notice 非管理员不能提取挑战资助
    function testUnauthorizedAddressCannotWithdrawFunds() public {
        vm.prank(funder);
        guardian.fundQuest{value: 2 ether}(QUEST_ID);

        vm.expectRevert();

        vm.prank(funder);
        guardian.withdrawQuestFunds(QUEST_ID, payable(recipient), 1 ether);

        (,,, uint256 remainingFunding) = guardian.quests(QUEST_ID);

        assertEq(remainingFunding, 2 ether);
        assertEq(recipient.balance, 0);
    }

    /// @notice 已关闭的关卡不能继续领取勋章
    function testInactiveQuestCannotBeCompleted() public {
        vm.prank(admin);
        guardian.setQuestActive(QUEST_ID, false);

        vm.expectRevert(abi.encodeWithSelector(GuardianQuest.QuestInactive.selector, QUEST_ID));

        vm.prank(verifier);
        guardian.verifyCompletion(learner, QUEST_ID, REPORT_HASH);
    }
}
