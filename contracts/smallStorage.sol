pragma solidity 0.6.1;

contract smallStorage {
    string storedData;

    constructor() payable {
        saveData = '';
    }

    function set(string memory x) public payable {
        saveData = x;
    }

    function get() public view returns (string memory) {
        return saveData;
    }
}
