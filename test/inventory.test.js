const clerk = require("../lib/index")
const assert = require("assert")
const sinon = require("sinon")
const loadFixture = require("./testHelper").loadFixture
const djv = require("djv")

describe("Inventory", function () {
  beforeEach(function() {
    this.client = new clerk.GitHubClient("abc123")
  })

  afterEach(function() {
    sinon.restore()
  })

  describe("#build()", function () {
    it("handles an Array arg for the org parameter", function () {
      const getReleasesStub = sinon.stub(clerk.Inventory.prototype, "getReleases")
      const inventory = new clerk.Inventory(this.client, "ABC")
      return inventory.build(["ABC", "DEF", "XYZ"]).then(() => {
        assert.equal(getReleasesStub.callCount, 3)
      })
    })

    it("handles a String arg for the org parameter", function () {
      const getReleasesStub = sinon.stub(clerk.Inventory.prototype, "getReleases")
      const inventory = new clerk.Inventory(this.client, "ABC")
      return inventory.build("ABC").then(() => {
        assert.equal(getReleasesStub.callCount, 1)
      })
    })
  })

  describe("#getReleases()", function () {
    it("correctly performs YAML overrides", function () {
      const repoEdgesFixture = require("./fixtures/getAllRepositoriesResult")
      const getAllRepositoriesStub = sinon.stub(clerk.GitHubClient.prototype, "getAllRepositories")
      getAllRepositoriesStub.resolves(repoEdgesFixture)
      const inventory = new clerk.Inventory(this.client, "ABC")

      return inventory.getReleases("ABC").then((result) => {
        assert.equal(result[0].name, "Test 1 Override")
        assert.equal(result[0].description, "Description override")
        assert.equal(result[1].name, "mobile-fu")
      })
    })

    it("correctly performs local overrides", function () {
      const repoEdgesFixture = require("./fixtures/getAllRepositoriesResult")
      const getAllRepositoriesStub = sinon.stub(clerk.GitHubClient.prototype, "getAllRepositories")
      getAllRepositoriesStub.resolves(repoEdgesFixture)

      const localOverrides = {
        contact: {
          email: "test@example.com"
        }
      }

      const inventory = new clerk.Inventory(this.client, "ABC", null, {
        localOverrides: localOverrides
      })

      return inventory.getReleases("ABC").then((result) => {
        assert.equal(result[0].contact.email, "test@example.com")
        assert.equal(result[1].contact.email, "test@example.com")
      })
    })

    it("correctly performs a user-specified callback", function () {
      const repoEdgesFixture = require("./fixtures/getAllRepositoriesResult")
      const getAllRepositoriesStub = sinon.stub(clerk.GitHubClient.prototype, "getAllRepositories")
      getAllRepositoriesStub.resolves(repoEdgesFixture)

      let callbackCounter = 0
      const callback = (metadata) => {
        metadata.newInfo = `item ${callbackCounter}`
        callbackCounter++
      }

      const inventory = new clerk.Inventory(this.client, "ABC", null, {
        callback: callback
      })

      return inventory.getReleases("ABC").then((result) => {
        assert(result[0].newInfo)
        assert.equal(result[0].newInfo, "item 0")
        assert.equal(result[1].newInfo, "item 1")
      })
    })

    it("correctly passes args to a user-specified callback", function () {
      const repoEdgesFixture = require("./fixtures/getAllRepositoriesResult")
      const getAllRepositoriesStub = sinon.stub(clerk.GitHubClient.prototype, "getAllRepositories")
      getAllRepositoriesStub.resolves(repoEdgesFixture)

      const callback = sinon.spy()

      const inventory = new clerk.Inventory(this.client, "ABC", null, {
        callback: callback
      })

      return inventory.getReleases("ABC").then((result) => {
        assert(callback.called)
        assert(callback.calledWithMatch(sinon.match.has("name"), "ABC"))
      })
    })
  })

  describe("#transform()", function () {
    it("correctly executes a transform on data", function () {
      const transform = `{
        "name": name,
        "description": $boolean(description) ? description : name,
        "nonexistent": nonexistent
      }`
      const repoData = JSON.parse(loadFixture("repositoryQueryResponse.json")).data.repository
      const inventory = new clerk.Inventory(this.client, "ABC")
      const result = inventory.applyTransform(transform, repoData)
      assert.equal(result.name, "cto-website")
      assert.equal(result.description, "Tech at GSA website")
      assert.equal(result.nonexistent, undefined)
    })
  })

  describe("#metadata()", function () {
    it("returns a format compliant with Code.gov schema", function () {
      const validator = djv({ version: "draft-04" })
      validator.addSchema("2.0.0", JSON.parse(loadFixture("codegov-schema-2.0.0.json")))
      const inventory = new clerk.Inventory(this.client, "ABC")
      const metadata = inventory.metadata()
      assert(validator.validate("2.0.0", metadata))
      assert.equal(metadata.version, "2.0.0")
    })
  })
})
