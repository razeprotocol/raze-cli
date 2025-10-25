// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract CeloNFTDrop is ERC721URIStorage, Ownable {
    IERC20 public immutable paymentToken; // e.g., cUSD
    uint256 public price; // price in paymentToken units (18 decimals cUSD)
    uint256 public nextId = 1;
    string public baseTokenURI;

    event Minted(address indexed to, uint256 indexed tokenId, uint256 price);

    constructor(address _paymentToken, uint256 _price, string memory _baseURI)
        ERC721("Celo NFT Drop", "cDROP")
        Ownable(msg.sender)
    {
        paymentToken = IERC20(_paymentToken);
        price = _price;
        baseTokenURI = _baseURI;
    }

    function setPrice(uint256 _price) external onlyOwner { price = _price; }
    function setBaseURI(string calldata _uri) external onlyOwner { baseTokenURI = _uri; }

    function _baseURI() internal view override returns (string memory) {
        return baseTokenURI;
    }

    function mint() external {
        // Pull payment in cUSD from minter
        require(paymentToken.transferFrom(msg.sender, owner(), price), "PAYMENT_FAIL");
        uint256 tokenId = nextId++;
        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId, price);
    }
}
