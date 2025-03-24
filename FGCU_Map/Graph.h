/*
Created by sebastian on 11/21/2024.
Data structure & algorithm Final project
This project should creat a map of fgcu and use dijkstras algorithm to find the quickest or shortest
path from the users chosen buildings
*/


#ifndef GRAPH_H
#define GRAPH_H
#include <vector>
#include <string>
#include <unordered_map>
using namespace std;

struct edge{//define edges for map
    string toBuilding;
    string direction;
    string pathway;
    int distance;
    double speed;//ft per s
};

struct PathInfo {//return dijktras algorithm result
    vector<string> path;//keeps list of path
    vector<edge> pathwayEdges;//connects struct edge to pathinfo
    int totalDistance;//feet
    double totalTime;//minutes
};

class Graph{
public:
    unordered_map<string, vector<edge>> adjList;
    void addEdge(const string& from, const string& to, const string& pathway,
        const string& direction, int distance, double speed);
    PathInfo dijkstra(const string& start, const string& end, bool shortest = true);
};

void quickSort(vector<string>& list,int low, int high);
int partition(vector<string>& list, int low, int high);
void readCSV(const string& fileName, Graph& graph, vector<string>& buildings);

#endif //GRAPH_H
