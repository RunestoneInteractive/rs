// this is just temporary data for the tree table for prototyping.
// This will go away and be replaced by api calls to the server.
// connected to Redux data structures.
export const NodeService = {
  getTreeNodesData() {
    return [];
  },

  getTreeTableNodesData() {
    return [
      {
        key: "chapter1",
        data: {
          name: "Getting Started",
        },
        children: [
          {
            key: "subchap1",
            data: {
              name: "Pretest for the CSA Exam",
            },
            children: [
              {
                key: "foo",
                data: {
                  name: "Exercise 1.2.1",
                  question_type: "Multiple Choice",
                  autograde: "Yes",
                  question_json: "",
                },
              },
            ],
          },
        ],
      },
      {
        key: "1",
        data: {
          name: "Preview 2.1.1",
          question_type: "Parsons",
          autograde: "Yes",
        },
      },
      {
        key: "2",
        data: {
          name: "Exercise 3.1.1",
          question_type: "Active Code",
          autograde: "No",
        },
      },
      {
        key: "3",
        data: {
          name: "Exercise 3.2.1",
          question_type: "Active Code",
          autograde: "Yes",
        },
      },
      // {
      //     key: '4',
      //     data: {
      //         name: 'Downloads',
      //         size: '25kb',
      //         type: 'Folder'
      //     },
      //     children: [
      //         {
      //             key: '4-0',
      //             data: {
      //                 name: 'Spanish',
      //                 size: '10kb',
      //                 type: 'Folder'
      //             },
      //             children: [
      //                 {
      //                     key: '4-0-0',
      //                     data: {
      //                         name: 'tutorial-a1.txt',
      //                         size: '5kb',
      //                         type: 'Text'
      //                     }
      //                 },
      //                 {
      //                     key: '4-0-1',
      //                     data: {
      //                         name: 'tutorial-a2.txt',
      //                         size: '5kb',
      //                         type: 'Text'
      //                     }
      //                 }
      //             ]
      //         },
      //         {
      //             key: '4-1',
      //             data: {
      //                 name: 'Travel',
      //                 size: '15kb',
      //                 type: 'Text'
      //             },
      //             children: [
      //                 {
      //                     key: '4-1-0',
      //                     data: {
      //                         name: 'Hotel.pdf',
      //                         size: '10kb',
      //                         type: 'PDF'
      //                     }
      //                 },
      //                 {
      //                     key: '4-1-1',
      //                     data: {
      //                         name: 'Flight.pdf',
      //                         size: '5kb',
      //                         type: 'PDF'
      //                     }
      //                 }
      //             ]
      //         }
      //     ]
      // },
      // {
      //     key: '5',
      //     data: {
      //         name: 'Main',
      //         size: '50kb',
      //         type: 'Folder'
      //     },
      //     children: [
      //         {
      //             key: '5-0',
      //             data: {
      //                 name: 'bin',
      //                 size: '50kb',
      //                 type: 'Link'
      //             }
      //         },
      //         {
      //             key: '5-1',
      //             data: {
      //                 name: 'etc',
      //                 size: '100kb',
      //                 type: 'Link'
      //             }
      //         },
      //         {
      //             key: '5-2',
      //             data: {
      //                 name: 'var',
      //                 size: '100kb',
      //                 type: 'Link'
      //             }
      //         }
      //     ]
      // },
      // {
      //     key: '6',
      //     data: {
      //         name: 'Other',
      //         size: '5kb',
      //         type: 'Folder'
      //     },
      //     children: [
      //         {
      //             key: '6-0',
      //             data: {
      //                 name: 'todo.txt',
      //                 size: '3kb',
      //                 type: 'Text'
      //             }
      //         },
      //         {
      //             key: '6-1',
      //             data: {
      //                 name: 'logo.png',
      //                 size: '2kb',
      //                 type: 'Picture'
      //             }
      //         }
      //     ]
      // },
      // {
      //     key: '7',
      //     data: {
      //         name: 'Pictures',
      //         size: '150kb',
      //         type: 'Folder'
      //     },
      //     children: [
      //         {
      //             key: '7-0',
      //             data: {
      //                 name: 'barcelona.jpg',
      //                 size: '90kb',
      //                 type: 'Picture'
      //             }
      //         },
      //         {
      //             key: '7-1',
      //             data: {
      //                 name: 'primeng.png',
      //                 size: '30kb',
      //                 type: 'Picture'
      //             }
      //         },
      //         {
      //             key: '7-2',
      //             data: {
      //                 name: 'prime.jpg',
      //                 size: '30kb',
      //                 type: 'Picture'
      //             }
      //         }
      //     ]
      // },
      // {
      //     key: '8',
      //     data: {
      //         name: 'Videos',
      //         size: '1500kb',
      //         type: 'Folder'
      //     },
      //     children: [
      //         {
      //             key: '8-0',
      //             data: {
      //                 name: 'primefaces.mkv',
      //                 size: '1000kb',
      //                 type: 'Video'
      //             }
      //         },
      //         {
      //             key: '8-1',
      //             data: {
      //                 name: 'intro.avi',
      //                 size: '500kb',
      //                 type: 'Video'
      //             }
      //         }
      //     ]
      // }
    ];
  },

  getTreeTableNodes() {
    return Promise.resolve(this.getTreeTableNodesData());
  },

  getTreeNodes() {
    return Promise.resolve(this.getTreeNodesData());
  },
};
