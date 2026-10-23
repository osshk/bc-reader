// Parse synthetic files only. This does not access CNContactStore or save contacts.
// swift -module-cache-path /tmp/bc-swift-cache scripts/check-apple-vcard.swift <fixture-directory>
import Foundation
import Contacts

struct Expected: Decodable {
    let firstName: String
    let lastName: String
    let company: String
    let jobTitle: String
}
let directory = URL(fileURLWithPath: CommandLine.arguments[1])
let expected = try JSONDecoder().decode([Expected].self, from: Data(contentsOf: directory.appendingPathComponent("expected.json")))
let contacts = try CNContactVCardSerialization.contacts(with: Data(contentsOf: directory.appendingPathComponent("contacts.vcf")))
guard contacts.count == expected.count else { fatalError("Wrong number of imported contacts") }
for (index, pair) in zip(contacts, expected).enumerated() {
    let (actual, wanted) = pair
    guard actual.organizationName == wanted.company,
          actual.jobTitle == wanted.jobTitle,
          actual.givenName == wanted.firstName,
          actual.familyName == wanted.lastName else { fatalError("Import changed fields in fixture \(index)") }
}
print("Apple Contacts: \(contacts.count) company, title and personal-name fixtures passed")
