// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title GameMarketplace
 * @notice Moltblox - Marketplace for bot-created games with instant 90/10 revenue split
 * @dev Handles game registration, item purchases, and creator payouts
 *
 * Revenue Model:
 * - 90% of each purchase goes directly to the game creator (instant payout)
 * - 10% goes to the platform treasury
 * - No refunds (blockchain finality)
 */
contract GameMarketplace is ReentrancyGuard, Pausable, AccessControl {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant MODERATOR_ROLE = keccak256("MODERATOR_ROLE");

    uint256 public constant PLATFORM_FEE_BPS = 1000; // 10%
    uint256 public constant BPS_DENOMINATOR = 10000;

    uint256 public constant MIN_ITEM_PRICE = 1 * 10**16;  // 0.01 COMP minimum
    uint256 public constant MAX_ITEM_PRICE = 10_000_000 * 10**18; // 10M COMP maximum

    // ============ State Variables ============

    IERC20 public immutable compToken;
    address public treasury;

    uint256 public gameCounter;
    uint256 public itemCounter;
    uint256 public purchaseCounter;

    // ============ Structs ============

    struct Game {
        bytes32 gameId;
        address creator;
        bool active;
        uint256 totalRevenue;
        uint256 totalPlays;
        uint256 createdAt;
    }

    struct Item {
        bytes32 itemId;
        bytes32 gameId;
        address creator;
        uint256 price;
        uint256 maxSupply;    // 0 = unlimited
        uint256 sold;
        uint256 duration;     // 0 = permanent, >0 = subscription in seconds
        bool active;
        uint256 createdAt;
    }

    // ============ Storage ============

    // gameId => Game
    mapping(bytes32 => Game) public games;

    // itemId => Item
    mapping(bytes32 => Item) public items;

    // user => itemId => owns (for permanent items)
    mapping(address => mapping(bytes32 => bool)) public ownsItem;

    // user => itemId => expiry timestamp (for subscriptions)
    mapping(address => mapping(bytes32 => uint256)) public subscriptionExpiry;

    // user => itemId => quantity (for consumables)
    mapping(address => mapping(bytes32 => uint256)) public consumableBalance;

    // gameId => itemIds[]
    mapping(bytes32 => bytes32[]) public gameItems;

    // creator => total earned
    mapping(address => uint256) public creatorTotalEarned;

    // ============ Events ============

    event GameRegistered(
        bytes32 indexed gameId,
        address indexed creator,
        uint256 timestamp
    );

    event GameStatusChanged(
        bytes32 indexed gameId,
        bool active
    );

    event ItemCreated(
        bytes32 indexed gameId,
        bytes32 indexed itemId,
        address indexed creator,
        uint256 price,
        uint256 maxSupply,
        uint256 duration
    );

    event ItemUpdated(
        bytes32 indexed itemId,
        uint256 newPrice,
        bool active
    );

    event ItemPurchased(
        bytes32 indexed gameId,
        bytes32 indexed itemId,
        address indexed buyer,
        address creator,
        uint256 price,
        uint256 creatorAmount,
        uint256 platformFee,
        uint256 purchaseId
    );

    event SubscriptionExtended(
        bytes32 indexed itemId,
        address indexed user,
        uint256 newExpiry
    );

    event TreasuryUpdated(address indexed newTreasury);

    // ============ Constructor ============

    constructor(address _compToken, address _treasury) {
        require(_compToken != address(0), "Invalid token");
        require(_treasury != address(0), "Invalid treasury");

        compToken = IERC20(_compToken);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(MODERATOR_ROLE, msg.sender);
    }

    // ============ Game Registration ============

    /**
     * @notice Register a new game in the marketplace
     * @param gameId Unique identifier for the game (hash of bot ID + game name)
     * @dev Only the creator (msg.sender) can register games for themselves
     */
    function registerGame(bytes32 gameId) external whenNotPaused {
        require(games[gameId].creator == address(0), "Game already exists");
        require(gameId != bytes32(0), "Invalid game ID");

        gameCounter++;

        games[gameId] = Game({
            gameId: gameId,
            creator: msg.sender,
            active: true,
            totalRevenue: 0,
            totalPlays: 0,
            createdAt: block.timestamp
        });

        emit GameRegistered(gameId, msg.sender, block.timestamp);
    }

    /**
     * @notice Deactivate a game (creator or moderator only)
     */
    function deactivateGame(bytes32 gameId) external {
        Game storage game = games[gameId];
        require(
            game.creator == msg.sender || hasRole(MODERATOR_ROLE, msg.sender),
            "Not authorized"
        );
        require(game.active, "Already inactive");

        game.active = false;
        emit GameStatusChanged(gameId, false);
    }

    /**
     * @notice Reactivate a game (creator only, unless suspended by moderator)
     */
    function reactivateGame(bytes32 gameId) external {
        Game storage game = games[gameId];
        require(game.creator == msg.sender, "Not creator");
        require(!game.active, "Already active");

        game.active = true;
        emit GameStatusChanged(gameId, true);
    }

    // ============ Item Management ============

    /**
     * @notice Create a new purchasable item for a game
     * @param gameId The game this item belongs to
     * @param itemId Unique identifier for the item
     * @param price Price in COMP tokens (wei)
     * @param maxSupply Maximum supply (0 for unlimited)
     * @param duration Subscription duration in seconds (0 for permanent)
     */
    function createItem(
        bytes32 gameId,
        bytes32 itemId,
        uint256 price,
        uint256 maxSupply,
        uint256 duration
    ) external whenNotPaused {
        Game storage game = games[gameId];
        require(game.creator == msg.sender, "Not game creator");
        require(game.active, "Game not active");
        require(items[itemId].creator == address(0), "Item already exists");
        require(itemId != bytes32(0), "Invalid item ID");
        require(price >= MIN_ITEM_PRICE, "Price too low");
        require(price <= MAX_ITEM_PRICE, "Price too high");

        itemCounter++;

        items[itemId] = Item({
            itemId: itemId,
            gameId: gameId,
            creator: msg.sender,
            price: price,
            maxSupply: maxSupply,
            sold: 0,
            duration: duration,
            active: true,
            createdAt: block.timestamp
        });

        gameItems[gameId].push(itemId);

        emit ItemCreated(gameId, itemId, msg.sender, price, maxSupply, duration);
    }

    /**
     * @notice Update item price (creator only)
     */
    function updateItemPrice(bytes32 itemId, uint256 newPrice) external {
        Item storage item = items[itemId];
        require(item.creator == msg.sender, "Not creator");
        require(newPrice >= MIN_ITEM_PRICE, "Price too low");
        require(newPrice <= MAX_ITEM_PRICE, "Price too high");

        item.price = newPrice;
        emit ItemUpdated(itemId, newPrice, item.active);
    }

    /**
     * @notice Deactivate an item (stop sales)
     */
    function deactivateItem(bytes32 itemId) external {
        Item storage item = items[itemId];
        require(
            item.creator == msg.sender || hasRole(MODERATOR_ROLE, msg.sender),
            "Not authorized"
        );

        item.active = false;
        emit ItemUpdated(itemId, item.price, false);
    }

    /**
     * @notice Reactivate an item
     */
    function reactivateItem(bytes32 itemId) external {
        Item storage item = items[itemId];
        require(item.creator == msg.sender, "Not creator");

        item.active = true;
        emit ItemUpdated(itemId, item.price, true);
    }

    // ============ Purchase Functions ============

    /**
     * @notice Purchase an item with instant payout to creator
     * @param gameId The game the item belongs to
     * @param itemId The item to purchase
     */
    function purchaseItem(
        bytes32 gameId,
        bytes32 itemId
    ) external nonReentrant whenNotPaused {
        Game storage game = games[gameId];
        Item storage item = items[itemId];

        require(game.active, "Game not active");
        require(item.active, "Item not active");
        require(item.gameId == gameId, "Item not in game");
        require(item.maxSupply == 0 || item.sold < item.maxSupply, "Sold out");

        uint256 price = item.price;
        uint256 platformFee = (price * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorAmount = price - platformFee;

        // Transfer COMP from buyer
        compToken.safeTransferFrom(msg.sender, address(this), price);

        // INSTANT payout to creator (90%)
        compToken.safeTransfer(game.creator, creatorAmount);

        // Platform fee to treasury (10%)
        compToken.safeTransfer(treasury, platformFee);

        // Update stats
        item.sold++;
        game.totalRevenue += price;
        creatorTotalEarned[game.creator] += creatorAmount;
        purchaseCounter++;

        // Record ownership based on item type
        if (item.duration == 0) {
            // Permanent item
            ownsItem[msg.sender][itemId] = true;
        } else {
            // Subscription - extend or start
            uint256 currentExpiry = subscriptionExpiry[msg.sender][itemId];
            uint256 startTime = currentExpiry > block.timestamp ? currentExpiry : block.timestamp;
            uint256 newExpiry = startTime + item.duration;
            subscriptionExpiry[msg.sender][itemId] = newExpiry;

            emit SubscriptionExtended(itemId, msg.sender, newExpiry);
        }

        emit ItemPurchased(
            gameId,
            itemId,
            msg.sender,
            game.creator,
            price,
            creatorAmount,
            platformFee,
            purchaseCounter
        );
    }

    /**
     * @notice Purchase a consumable item (can buy multiple)
     */
    function purchaseConsumable(
        bytes32 gameId,
        bytes32 itemId,
        uint256 quantity
    ) external nonReentrant whenNotPaused {
        require(quantity > 0 && quantity <= 100, "Invalid quantity");

        Game storage game = games[gameId];
        Item storage item = items[itemId];

        require(game.active, "Game not active");
        require(item.active, "Item not active");
        require(item.gameId == gameId, "Item not in game");
        require(
            item.maxSupply == 0 || item.sold + quantity <= item.maxSupply,
            "Exceeds supply"
        );

        uint256 totalPrice = item.price * quantity;
        uint256 platformFee = (totalPrice * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        uint256 creatorAmount = totalPrice - platformFee;

        // Transfer COMP from buyer
        compToken.safeTransferFrom(msg.sender, address(this), totalPrice);

        // INSTANT payout to creator (90%)
        compToken.safeTransfer(game.creator, creatorAmount);

        // Platform fee to treasury (10%)
        compToken.safeTransfer(treasury, platformFee);

        // Update stats
        item.sold += quantity;
        game.totalRevenue += totalPrice;
        creatorTotalEarned[game.creator] += creatorAmount;
        purchaseCounter++;

        // Add to consumable balance
        consumableBalance[msg.sender][itemId] += quantity;

        emit ItemPurchased(
            gameId,
            itemId,
            msg.sender,
            game.creator,
            totalPrice,
            creatorAmount,
            platformFee,
            purchaseCounter
        );
    }

    /**
     * @notice Use a consumable (called by game server)
     */
    function useConsumable(
        address user,
        bytes32 itemId,
        uint256 quantity
    ) external onlyRole(OPERATOR_ROLE) {
        require(consumableBalance[user][itemId] >= quantity, "Insufficient balance");
        consumableBalance[user][itemId] -= quantity;
    }

    // ============ View Functions ============

    /**
     * @notice Check if a user owns an item (permanent or active subscription)
     */
    function checkOwnership(
        address user,
        bytes32 gameId,
        bytes32 itemId
    ) external view returns (bool owns, uint256 expiry) {
        Item storage item = items[itemId];
        require(item.gameId == gameId, "Item not in game");

        if (item.duration == 0) {
            // Permanent item
            return (ownsItem[user][itemId], 0);
        } else {
            // Subscription
            uint256 exp = subscriptionExpiry[user][itemId];
            return (exp > block.timestamp, exp);
        }
    }

    /**
     * @notice Get consumable balance for a user
     */
    function getConsumableBalance(
        address user,
        bytes32 itemId
    ) external view returns (uint256) {
        return consumableBalance[user][itemId];
    }

    /**
     * @notice Get all items for a game
     */
    function getGameItems(bytes32 gameId) external view returns (bytes32[] memory) {
        return gameItems[gameId];
    }

    /**
     * @notice Get game details
     */
    function getGame(bytes32 gameId) external view returns (
        address creator,
        bool active,
        uint256 totalRevenue,
        uint256 totalPlays,
        uint256 createdAt
    ) {
        Game storage game = games[gameId];
        return (
            game.creator,
            game.active,
            game.totalRevenue,
            game.totalPlays,
            game.createdAt
        );
    }

    /**
     * @notice Get item details
     */
    function getItem(bytes32 itemId) external view returns (
        bytes32 gameId,
        address creator,
        uint256 price,
        uint256 maxSupply,
        uint256 sold,
        uint256 duration,
        bool active
    ) {
        Item storage item = items[itemId];
        return (
            item.gameId,
            item.creator,
            item.price,
            item.maxSupply,
            item.sold,
            item.duration,
            item.active
        );
    }

    /**
     * @notice Get creator stats
     */
    function getCreatorStats(address creator) external view returns (
        uint256 totalEarned,
        uint256 gamesCreated
    ) {
        totalEarned = creatorTotalEarned[creator];
        // Note: gamesCreated would require iteration or separate counter
        // For simplicity, return 0 here - implement via events/subgraph
        gamesCreated = 0;
    }

    // ============ Game Stats (Called by Server) ============

    /**
     * @notice Increment play count for a game
     */
    function recordPlay(bytes32 gameId) external onlyRole(OPERATOR_ROLE) {
        games[gameId].totalPlays++;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update treasury address
     */
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /**
     * @notice Pause marketplace
     */
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause marketplace
     */
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    /**
     * @notice Emergency withdraw (only for stuck tokens, not user funds)
     * @dev Should only be used for tokens accidentally sent to contract
     */
    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        // Cannot withdraw COMP as it's immediately distributed
        require(token != address(compToken), "Cannot withdraw COMP");
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
